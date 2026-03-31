import type { ModelOption, PromptPreset } from "@/lib/types";

export const APP_NAME = "ListingLens";

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "gemini-flash-4k",
    label: "gemini-3.1-flash-image-preview-4k",
    priceLabel: "0.1 元/张",
    description: "默认模型，适合快速做主图本地化与风格提升。",
  },
  {
    id: "nano-banana-4k",
    label: "nano-banana-2-4k",
    priceLabel: "0.2 元/张",
    description: "备选模型，适合需要更强视觉变化时使用。",
  },
];

export const DEFAULT_MODEL_ID = MODEL_OPTIONS[0].id;

export const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: "layout-preserve",
    name: "文字本地化并保留版式",
    summary: "优先翻译替字，尽量保持原图构图、字位与视觉节奏。",
    focus: "text-localization",
  },
  {
    id: "localized-beauty",
    name: "本地化 + 主图美化",
    summary: "在翻译基础上提升质感、对比度与电商吸引力。",
    focus: "localized-beauty",
  },
  {
    id: "sales-booster",
    name: "本地化 + 卖点强化",
    summary: "增强卖点层级与信息可读性，但不虚构功能或参数。",
    focus: "sales-booster",
  },
];

export const DEFAULT_PRESET_ID = "localized-beauty";

export const LANGUAGE_SUGGESTIONS = [
  "English",
  "Deutsch",
  "Français",
  "Español",
  "Italiano",
  "Português",
  "Polski",
  "Nederlands",
  "日本語",
  "한국어",
  "简体中文",
  "繁體中文",
  "Türkçe",
  "Русский",
  "العربية",
];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_REMOTE_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_HTML_BYTES = 2.5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
