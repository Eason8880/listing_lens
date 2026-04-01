export const MODEL_FAMILY_IDS = ["gemini-flash", "nano-banana"] as const;
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
  "4:3",
  "3:2",
  "16:9",
] as const;

export type ModelFamilyId = (typeof MODEL_FAMILY_IDS)[number];
export type ResolutionId = (typeof RESOLUTION_IDS)[number];
export type PromptPresetId = (typeof PROMPT_PRESET_IDS)[number];
export type AspectRatioId = (typeof ASPECT_RATIO_IDS)[number];

export interface ModelFamilyOption {
  id: ModelFamilyId;
  label: string;
  priceLabel: string;
  description: string;
  models: Record<ResolutionId, string>;
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
  revisedPrompt?: string;
  model: string;
}
