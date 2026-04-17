import { API_BASE_URL } from "@/lib/constants";
import {
  buildGenerationAttempts,
  type GenerationAttempt,
  type ImageApiPayload,
} from "@/lib/image-generation";
import type { AspectRatioId, ModelFamilyId, ResolutionId } from "@/lib/types";

type RequestImageGenerationInput = {
  apiKey: string;
  prompt: string;
  modelFamilyId: ModelFamilyId;
  resolutionId: ResolutionId;
  aspectRatioId: AspectRatioId;
  sourceFile: File;
  fetchImpl?: typeof fetch;
};

type RequestImageGenerationResult = {
  payload: ImageApiPayload;
  attempt: GenerationAttempt;
  requestedModelFamilyId: ModelFamilyId;
  requestedModel: string;
};

const DEFAULT_ERROR_MESSAGE = "图片生成失败，请稍后重试。";

function getImageGenerationErrorMessage(payload: ImageApiPayload) {
  return (
    (typeof payload.error?.message === "string" && payload.error.message) ||
    (typeof payload.message === "string" && payload.message) ||
    DEFAULT_ERROR_MESSAGE
  );
}

async function parseImageApiPayload(response: Response): Promise<ImageApiPayload> {
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as ImageApiPayload;
  }

  const rawText = await response.text();

  return rawText.trim() ? { message: rawText.trim() } : {};
}

async function readFileAsDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());

  return `data:${file.type || "image/png"};base64,${buffer.toString("base64")}`;
}

async function executeGenerationAttempt({
  apiKey,
  attempt,
  aspectRatioId,
  prompt,
  sourceFile,
  sourceImageDataUrl,
  fetchImpl,
}: {
  apiKey: string;
  attempt: GenerationAttempt;
  aspectRatioId: AspectRatioId;
  prompt: string;
  sourceFile: File;
  sourceImageDataUrl?: string;
  fetchImpl: typeof fetch;
}) {
  if (attempt.requestStrategy === "generations-json-size") {
    return fetchImpl(`${API_BASE_URL}${attempt.endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: attempt.model,
        prompt,
        image: sourceImageDataUrl,
        size: attempt.size,
        n: 1,
        response_format: attempt.responseFormat,
      }),
    });
  }

  const body = new FormData();
  body.append("model", attempt.model);
  body.append("prompt", prompt);
  body.append("n", "1");
  body.append("response_format", attempt.responseFormat);
  body.append("image", sourceFile, sourceFile.name);

  if (attempt.requestStrategy === "edits-model-name") {
    body.append("aspect_ratio", aspectRatioId);
  }

  if (attempt.size) {
    body.append("size", attempt.size);
  }

  return fetchImpl(`${API_BASE_URL}${attempt.endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    body,
  });
}

function isRetriableNetworkError(error: unknown) {
  return error instanceof TypeError && /Failed to fetch|fetch failed/i.test(error.message);
}

function shouldRetryAttempt(attempt: GenerationAttempt, error: unknown) {
  return attempt.familyId === "nano-banana" && isRetriableNetworkError(error);
}

export async function requestImageGeneration({
  apiKey,
  prompt,
  modelFamilyId,
  resolutionId,
  aspectRatioId,
  sourceFile,
  fetchImpl = fetch,
}: RequestImageGenerationInput): Promise<RequestImageGenerationResult> {
  const attempts = buildGenerationAttempts({
    modelFamilyId,
    resolutionId,
    aspectRatioId,
  });
  const requestedModel = attempts[0]?.model ?? "";
  let sourceImageDataUrlPromise: Promise<string> | undefined;
  let lastErrorMessage = DEFAULT_ERROR_MESSAGE;

  for (const attempt of attempts) {
    for (let retryCount = 0; retryCount < 2; retryCount += 1) {
      try {
        const response = await executeGenerationAttempt({
          apiKey,
          attempt,
          aspectRatioId,
          prompt,
          sourceFile,
          sourceImageDataUrl:
            attempt.requestStrategy === "generations-json-size"
              ? await (sourceImageDataUrlPromise ??= readFileAsDataUrl(sourceFile))
              : undefined,
          fetchImpl,
        });
        const payload = await parseImageApiPayload(response);

        if (!response.ok) {
          lastErrorMessage = getImageGenerationErrorMessage(payload);
          break;
        }

        return {
          payload,
          attempt,
          requestedModelFamilyId: modelFamilyId,
          requestedModel,
        };
      } catch (error) {
        if (retryCount === 0 && shouldRetryAttempt(attempt, error)) {
          continue;
        }

        lastErrorMessage =
          error instanceof Error && error.message.trim()
            ? error.message
            : DEFAULT_ERROR_MESSAGE;
        break;
      }
    }
  }

  throw new Error(lastErrorMessage);
}
