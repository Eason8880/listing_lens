export const MODEL_FAMILY_IDS = [
  "gemini-flash",
  "nano-banana",
  "nano-banana-pro",
  "doubao-seedream",
  "gpt-image-1-5",
  "gemini-pro-preview",
] as const;
export const RESOLUTION_IDS = ["1k", "2k", "4k"] as const;
export const PROMPT_PRESET_IDS = [
  "layout-preserve",
  "localized-beauty",
  "sales-booster",
] as const;
export const ASPECT_RATIO_IDS = [
  "1:1",
  "4:5",
  "3:4",
  "2:3",
  "4:3",
  "3:2",
  "16:9",
] as const;

export type ModelFamilyId = (typeof MODEL_FAMILY_IDS)[number];
export type ResolutionId = (typeof RESOLUTION_IDS)[number];
export type PromptPresetId = (typeof PROMPT_PRESET_IDS)[number];
export type AspectRatioId = (typeof ASPECT_RATIO_IDS)[number];
export type RequestStrategy =
  | "edits-model-name"
  | "edits-size"
  | "generations-json-size";
export type ImageDeliveryKind = "external-url" | "local-data";

export interface ModelFamilyOption {
  id: ModelFamilyId;
  label: string;
  priceLabel: string;
  description: string;
  baseModel: string;
  requestStrategy: RequestStrategy;
  modelByResolution?: Partial<Record<ResolutionId, string>>;
  priceLabelByResolution?: Partial<Record<ResolutionId, string>>;
  selectable?: boolean;
  fallbackModelFamilyIds?: ModelFamilyId[];
  supportedAspectRatioIds?: AspectRatioId[];
  supportedResolutionIds?: ResolutionId[];
}

export interface ResolutionOption {
  id: ResolutionId;
  label: string;
  description: string;
}

export interface PromptPreset {
  id: PromptPresetId;
  name: string;
  summary: string;
  focus: string;
}

export interface LanguageOption {
  value: string;
  label: string;
}

export interface AspectRatioOption {
  id: AspectRatioId;
  label: string;
  description: string;
  aspectRatio: string;
}

export interface ExtractedImageCandidate {
  url: string;
  source: string;
  width?: number;
  height?: number;
}

export interface GenerateImageRequest {
  sourceLanguage?: string;
  targetLanguage: string;
  aspectRatio: AspectRatioId;
  presetId: PromptPresetId;
  customPrompt?: string;
  modelFamily: ModelFamilyId;
  resolution: ResolutionId;
  remoteImageUrl?: string;
  image?: File;
}

export interface GenerateImageResponse {
  imageUrl: string;
  copyableImageUrl?: string;
  analysisImageUrl: string;
  deliveryKind: ImageDeliveryKind;
  revisedPrompt?: string;
  requestedModelFamilyId: ModelFamilyId;
  requestedModel: string;
  actualModelFamilyId: ModelFamilyId;
  actualModel: string;
  actualModelLabel: string;
  actualPriceLabel: string;
  usedFallback: boolean;
  aspectRatioId: AspectRatioId;
  resolutionId: ResolutionId;
}
