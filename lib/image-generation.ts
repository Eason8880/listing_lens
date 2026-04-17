import { MODEL_FAMILY_OPTIONS } from "@/lib/constants";
import { ASPECT_RATIO_IDS, RESOLUTION_IDS } from "@/lib/types";
import type {
  AspectRatioId,
  GenerateImageResponse,
  ImageDeliveryKind,
  ModelFamilyId,
  ModelFamilyOption,
  RequestStrategy,
  ResolutionId,
} from "@/lib/types";

export type ImageApiPayload = {
  data?: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
    mime_type?: string;
  }>;
  revised_prompt?: string;
  message?: string;
  error?: {
    message?: string;
  };
};

export type GenerationAttempt = {
  familyId: ModelFamilyId;
  familyLabel: string;
  priceLabel: string;
  model: string;
  requestStrategy: RequestStrategy;
  endpoint:
    | "/v1/images/edits"
    | "/v1/images/generations";
  responseFormat: "url" | "b64_json";
  size?: string;
};

type NormalizeGeneratedImageResultInput = {
  payload: ImageApiPayload;
  attempt: GenerationAttempt;
  createObjectUrl?: (blob: Blob) => string;
  requestedModelFamilyId: ModelFamilyId;
  requestedModel: string;
  aspectRatioId: AspectRatioId;
  resolutionId: ResolutionId;
};

const DEFAULT_MIME_TYPE = "image/png";
const RESOLUTION_LONG_EDGE: Record<ResolutionId, number> = {
  "1k": 1024,
  "2k": 2048,
  "4k": 4096,
};
const GPT_IMAGE_SIZE_MAP: Record<AspectRatioId, string | undefined> = {
  "1:1": "1024x1024",
  "4:5": undefined,
  "3:4": undefined,
  "2:3": "1024x1536",
  "4:3": undefined,
  "3:2": "1536x1024",
  "16:9": undefined,
};

function getModelFamilyOption(modelFamilyId: ModelFamilyId): ModelFamilyOption {
  const modelFamily = MODEL_FAMILY_OPTIONS.find((option) => option.id === modelFamilyId);

  if (!modelFamily) {
    throw new Error(`Unknown model family: ${modelFamilyId}`);
  }

  return modelFamily;
}

export function getSupportedAspectRatioIds(modelFamilyId: ModelFamilyId): AspectRatioId[] {
  return getModelFamilyOption(modelFamilyId).supportedAspectRatioIds ?? [...ASPECT_RATIO_IDS];
}

export function getSupportedResolutionIds(modelFamilyId: ModelFamilyId): ResolutionId[] {
  return getModelFamilyOption(modelFamilyId).supportedResolutionIds ?? [...RESOLUTION_IDS];
}

export function coerceGenerationSelection({
  modelFamilyId,
  aspectRatioId,
  resolutionId,
}: {
  modelFamilyId: ModelFamilyId;
  aspectRatioId: AspectRatioId;
  resolutionId: ResolutionId;
}) {
  const modelFamily = getModelFamilyOption(modelFamilyId);
  const supportedAspectRatioIds = getSupportedAspectRatioIds(modelFamilyId);
  const supportedResolutionIds = getSupportedResolutionIds(modelFamilyId);
  const nextAspectRatioId = supportedAspectRatioIds.includes(aspectRatioId)
    ? aspectRatioId
    : supportedAspectRatioIds[0];
  const nextResolutionId = supportedResolutionIds.includes(resolutionId)
    ? resolutionId
    : supportedResolutionIds[0];
  const wasAdjusted = nextAspectRatioId !== aspectRatioId || nextResolutionId !== resolutionId;

  return {
    aspectRatioId: nextAspectRatioId,
    resolutionId: nextResolutionId,
    wasAdjusted,
    message: wasAdjusted
      ? `${modelFamily.label} 当前仅支持 ${supportedResolutionIds.join(" / ")} 与 ${supportedAspectRatioIds.join(" / ")}，已自动调整为兼容设置。`
      : "",
  };
}

function buildResolutionAwareModelName(baseModel: string, resolutionId: ResolutionId) {
  return resolutionId === "1k" ? baseModel : `${baseModel}-${resolutionId}`;
}

function getResolutionAwareModelName(modelFamily: ModelFamilyOption, resolutionId: ResolutionId) {
  return (
    modelFamily.modelByResolution?.[resolutionId] ??
    buildResolutionAwareModelName(modelFamily.baseModel, resolutionId)
  );
}

function getResolutionAwarePriceLabel(modelFamily: ModelFamilyOption, resolutionId: ResolutionId) {
  return modelFamily.priceLabelByResolution?.[resolutionId] ?? modelFamily.priceLabel;
}

function parseAspectRatio(aspectRatioId: AspectRatioId) {
  const [width, height] = aspectRatioId.split(":").map((value) => Number(value));

  return { width, height };
}

function buildExplicitSize(aspectRatioId: AspectRatioId, resolutionId: ResolutionId) {
  const { width, height } = parseAspectRatio(aspectRatioId);
  const longEdge = RESOLUTION_LONG_EDGE[resolutionId];

  if (width >= height) {
    return `${longEdge}x${Math.round(longEdge * (height / width))}`;
  }

  return `${Math.round(longEdge * (width / height))}x${longEdge}`;
}

function buildAttempt(
  modelFamilyId: ModelFamilyId,
  resolutionId: ResolutionId,
  aspectRatioId: AspectRatioId,
): GenerationAttempt {
  const modelFamily = getModelFamilyOption(modelFamilyId);
  const supportedAspectRatioIds = getSupportedAspectRatioIds(modelFamilyId);
  const supportedResolutionIds = getSupportedResolutionIds(modelFamilyId);

  if (!supportedAspectRatioIds.includes(aspectRatioId)) {
    throw new Error(`Aspect ratio ${aspectRatioId} is not supported for ${modelFamily.label}.`);
  }

  if (!supportedResolutionIds.includes(resolutionId)) {
    throw new Error(`Resolution ${resolutionId} is not supported for ${modelFamily.label}.`);
  }

  switch (modelFamily.requestStrategy) {
    case "edits-model-name":
      return {
        familyId: modelFamily.id,
        familyLabel: modelFamily.label,
        priceLabel: getResolutionAwarePriceLabel(modelFamily, resolutionId),
        model: getResolutionAwareModelName(modelFamily, resolutionId),
        requestStrategy: modelFamily.requestStrategy,
        endpoint: "/v1/images/edits",
        responseFormat: "url",
      };
    case "generations-json-size":
      return {
        familyId: modelFamily.id,
        familyLabel: modelFamily.label,
        priceLabel: modelFamily.priceLabel,
        model: modelFamily.baseModel,
        requestStrategy: modelFamily.requestStrategy,
        endpoint: "/v1/images/generations",
        responseFormat: "url",
        size: buildExplicitSize(aspectRatioId, resolutionId),
      };
    case "edits-size": {
      const size = GPT_IMAGE_SIZE_MAP[aspectRatioId];

      if (!size) {
        throw new Error(`Aspect ratio ${aspectRatioId} is not supported for ${modelFamily.label}.`);
      }

      return {
        familyId: modelFamily.id,
        familyLabel: modelFamily.label,
        priceLabel: modelFamily.priceLabel,
        model: modelFamily.baseModel,
        requestStrategy: modelFamily.requestStrategy,
        endpoint: "/v1/images/edits",
        responseFormat: "b64_json",
        size,
      };
    }
    default:
      throw new Error(`Unsupported request strategy: ${modelFamily.requestStrategy satisfies never}`);
  }
}

export function buildGenerationAttempts({
  modelFamilyId,
  resolutionId,
  aspectRatioId,
}: {
  modelFamilyId: ModelFamilyId;
  resolutionId: ResolutionId;
  aspectRatioId: AspectRatioId;
}) {
  const modelFamily = getModelFamilyOption(modelFamilyId);

  return [modelFamily.id, ...(modelFamily.fallbackModelFamilyIds ?? [])].map((familyId) =>
    buildAttempt(familyId, resolutionId, aspectRatioId),
  );
}

export function getModelFamilyDisplayAttempt({
  modelFamilyId,
  resolutionId,
  aspectRatioId,
}: {
  modelFamilyId: ModelFamilyId;
  resolutionId: ResolutionId;
  aspectRatioId: AspectRatioId;
}) {
  const selection = coerceGenerationSelection({
    modelFamilyId,
    resolutionId,
    aspectRatioId,
  });

  return buildGenerationAttempts({
    modelFamilyId,
    resolutionId: selection.resolutionId,
    aspectRatioId: selection.aspectRatioId,
  })[0];
}

function formatResolutionId(resolutionId: ResolutionId) {
  return resolutionId.toUpperCase();
}

export function getResolutionPriceChangeNotice({
  modelFamilyId,
  currentResolutionId,
  nextResolutionId,
  aspectRatioId,
}: {
  modelFamilyId: ModelFamilyId;
  currentResolutionId: ResolutionId;
  nextResolutionId: ResolutionId;
  aspectRatioId: AspectRatioId;
}) {
  const currentAttempt = getModelFamilyDisplayAttempt({
    modelFamilyId,
    resolutionId: currentResolutionId,
    aspectRatioId,
  });
  const nextAttempt = getModelFamilyDisplayAttempt({
    modelFamilyId,
    resolutionId: nextResolutionId,
    aspectRatioId,
  });

  if (currentAttempt.priceLabel === nextAttempt.priceLabel) {
    return "";
  }

  return `${currentAttempt.familyLabel} 切换到 ${formatResolutionId(nextResolutionId)} 后按 ${nextAttempt.priceLabel} 计费。`;
}

export function supportsSellingPointExtraction({
  modelFamilyId,
  resolutionId,
  aspectRatioId,
}: {
  modelFamilyId: ModelFamilyId;
  resolutionId: ResolutionId;
  aspectRatioId: AspectRatioId;
}) {
  return buildGenerationAttempts({
    modelFamilyId,
    resolutionId,
    aspectRatioId,
  })[0]?.responseFormat === "url";
}

function getRevisedPrompt(payload: ImageApiPayload) {
  const resultPayload = Array.isArray(payload.data) ? payload.data[0] : undefined;

  if (typeof resultPayload?.revised_prompt === "string" && resultPayload.revised_prompt.trim()) {
    return resultPayload.revised_prompt;
  }

  if (typeof payload.revised_prompt === "string" && payload.revised_prompt.trim()) {
    return payload.revised_prompt;
  }

  return undefined;
}

function normalizeBase64ImageData(base64Value: string, mimeType?: string) {
  const trimmedValue = base64Value.trim();
  const dataUrlMatch = trimmedValue.match(/^data:(image\/[^;]+);base64,(.+)$/is);
  const extractedMimeType = dataUrlMatch?.[1]?.toLowerCase();
  const rawBase64 = dataUrlMatch?.[2] ?? trimmedValue;
  const compactBase64 = rawBase64.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = compactBase64.length % 4;

  return {
    mimeType: extractedMimeType || mimeType || DEFAULT_MIME_TYPE,
    base64:
      paddingLength === 0 ? compactBase64 : compactBase64.padEnd(compactBase64.length + (4 - paddingLength), "="),
  };
}

function decodeBase64ToBytes(base64Value: string) {
  const { base64 } = normalizeBase64ImageData(base64Value);
  const fromBase64 = (Uint8Array as typeof Uint8Array & {
    fromBase64?: (value: string) => Uint8Array;
  }).fromBase64;

  if (typeof fromBase64 === "function") {
    return fromBase64(base64);
  }

  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(base64, "base64"));
  }

  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function buildDataUrl(base64Value: string, mimeType: string) {
  return `data:${mimeType};base64,${base64Value.trim()}`;
}

function buildGeneratedImageData(
  payload: ImageApiPayload,
  responseFormat: GenerationAttempt["responseFormat"],
  createObjectUrl?: (blob: Blob) => string,
): { imageUrl: string; copyableImageUrl?: string; analysisImageUrl: string; deliveryKind: ImageDeliveryKind } {
  const resultPayload = Array.isArray(payload.data) ? payload.data[0] : undefined;

  if (responseFormat === "b64_json" && typeof resultPayload?.b64_json === "string" && resultPayload.b64_json.trim()) {
    const normalizedImageData = normalizeBase64ImageData(
      resultPayload.b64_json,
      resultPayload.mime_type,
    );
    const analysisImageUrl = buildDataUrl(normalizedImageData.base64, normalizedImageData.mimeType);
    const decodedBytes = decodeBase64ToBytes(normalizedImageData.base64);
    const blobBytes = new Uint8Array(decodedBytes);
    const imageUrl = createObjectUrl
      ? createObjectUrl(new Blob([blobBytes.buffer], { type: normalizedImageData.mimeType }))
      : analysisImageUrl;

    return {
      imageUrl,
      analysisImageUrl,
      deliveryKind: "local-data",
    };
  }

  if (typeof resultPayload?.url === "string" && resultPayload.url.trim()) {
    return {
      imageUrl: resultPayload.url,
      copyableImageUrl: resultPayload.url,
      analysisImageUrl: resultPayload.url,
      deliveryKind: "external-url",
    };
  }

  throw new Error("图片生成失败，服务端没有返回可用图片。");
}

export function normalizeGeneratedImageResult({
  payload,
  attempt,
  createObjectUrl,
  requestedModelFamilyId,
  requestedModel,
  aspectRatioId,
  resolutionId,
}: NormalizeGeneratedImageResultInput): GenerateImageResponse {
  const imageData = buildGeneratedImageData(payload, attempt.responseFormat, createObjectUrl);

  return {
    ...imageData,
    revisedPrompt: getRevisedPrompt(payload),
    requestedModelFamilyId,
    requestedModel,
    actualModelFamilyId: attempt.familyId,
    actualModel: attempt.model,
    actualModelLabel: attempt.familyLabel,
    actualPriceLabel: attempt.priceLabel,
    usedFallback: requestedModelFamilyId !== attempt.familyId,
    aspectRatioId,
    resolutionId,
  };
}
