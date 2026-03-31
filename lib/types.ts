export const MODEL_OPTION_IDS = ["gemini-flash-4k", "nano-banana-4k"] as const;
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

export type ModelOptionId = (typeof MODEL_OPTION_IDS)[number];
export type PromptPresetId = (typeof PROMPT_PRESET_IDS)[number];
export type AspectRatioId = (typeof ASPECT_RATIO_IDS)[number];

export interface ModelOption {
  id: ModelOptionId;
  label: string;
  priceLabel: string;
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
  model: ModelOptionId;
  remoteImageUrl?: string;
  image?: File;
}

export interface GenerateImageResponse {
  imageUrl: string;
  revisedPrompt?: string;
  model: string;
}
