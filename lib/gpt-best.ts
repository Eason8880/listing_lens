import { AppError } from "@/lib/app-error";
import type { ModelOptionId } from "@/lib/types";

const MODEL_API_MAP: Record<ModelOptionId, string> = {
  "gemini-flash-4k":
    process.env.GPT_BEST_MODEL_GEMINI ?? "gemini-3.1-flash-image-preview-4k",
  "nano-banana-4k": process.env.GPT_BEST_MODEL_NANO ?? "nano-banana-2-4k",
};

function buildImagesEditsUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/v1") ? `${trimmed}/images/edits` : `${trimmed}/v1/images/edits`;
}

function getConfig() {
  const baseUrl = process.env.GPT_BEST_BASE_URL?.trim();
  const apiKey = process.env.GPT_BEST_API_KEY?.trim();

  if (!baseUrl) {
    throw new AppError("服务端缺少 GPT_BEST_BASE_URL 配置。", 500);
  }

  if (!apiKey) {
    throw new AppError("服务端缺少 GPT_BEST_API_KEY 配置。", 500);
  }

  return {
    baseUrl,
    apiKey,
  };
}

export async function generateEditedImage({
  file,
  modelId,
  prompt,
}: {
  file: File;
  modelId: ModelOptionId;
  prompt: string;
}) {
  const { baseUrl, apiKey } = getConfig();
  const formData = new FormData();

  formData.append("model", MODEL_API_MAP[modelId]);
  formData.append("prompt", prompt);
  formData.append("n", "1");
  formData.append("response_format", "url");
  formData.append("image", file, file.name || "listinglens-source.png");

  const response = await fetch(buildImagesEditsUrl(baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    body: formData,
    signal: AbortSignal.timeout(60000),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      `图片生成失败，服务商返回 ${response.status}。`;

    throw new AppError(message, 502);
  }

  const firstResult = payload?.data?.[0];

  if (firstResult?.url) {
    return {
      imageUrl: firstResult.url as string,
      revisedPrompt:
        (firstResult.revised_prompt as string | undefined) ||
        (payload?.revised_prompt as string | undefined),
      model: MODEL_API_MAP[modelId],
    };
  }

  if (firstResult?.b64_json) {
    return {
      imageUrl: `data:image/png;base64,${firstResult.b64_json as string}`,
      revisedPrompt:
        (firstResult.revised_prompt as string | undefined) ||
        (payload?.revised_prompt as string | undefined),
      model: MODEL_API_MAP[modelId],
    };
  }

  throw new AppError("服务商未返回可用图片 URL。", 502);
}
