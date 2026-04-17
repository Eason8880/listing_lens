import type {
  AspectRatioOption,
  LanguageOption,
  ModelFamilyOption,
  PromptPreset,
  ResolutionOption,
} from "@/lib/types";

export const APP_NAME = "ListingLens";
export const API_BASE_URL = "https://api.bltcy.ai";
export const API_KEY_STORAGE_KEY = "listinglens.apiKey";

export const MODEL_FAMILY_OPTIONS: ModelFamilyOption[] = [
  {
    id: "gemini-flash",
    label: "Nano Banana 2",
    priceLabel: "0.1 元/张",
    description: "轻量版本，适合快速做主图本地化与电商视觉优化。",
    baseModel: "gemini-3.1-flash-image-preview",
    requestStrategy: "edits-model-name",
  },
  {
    id: "nano-banana",
    label: "Nano Banana",
    priceLabel: "0.08 元/张",
    description: "标准版本，适合以更低成本完成常规商品主图优化。",
    baseModel: "nano-banana",
    supportedResolutionIds: ["1k", "2k"],
    modelByResolution: {
      "2k": "nano-banana-hd",
    },
    priceLabelByResolution: {
      "2k": "0.12 元/张",
    },
    requestStrategy: "edits-model-name",
  },
  {
    id: "nano-banana-pro",
    label: "Nano Banana Pro",
    priceLabel: "0.2 元/张",
    description: "高阶版本，适合需要更强视觉变化与重绘时使用。",
    baseModel: "nano-banana-2",
    requestStrategy: "edits-model-name",
    fallbackModelFamilyIds: ["gemini-pro-preview"],
  },
  {
    id: "doubao-seedream",
    label: "Doubao SeeDream 5.0",
    priceLabel: "0.15 元/次",
    description: "适合按明确尺寸输出并兼顾商品主体保真。",
    baseModel: "doubao-seedream-5-0-260128",
    requestStrategy: "generations-json-size",
  },
  {
    id: "gpt-image-1-5",
    label: "OpenAI GPT 1.5",
    priceLabel: "0.05 元/次",
    description: "适合使用 OpenAI 原生编辑尺寸输出方图、竖图和横图。",
    baseModel: "gpt-image-1.5",
    requestStrategy: "edits-size",
    supportedAspectRatioIds: ["1:1", "2:3", "3:2"],
    supportedResolutionIds: ["1k"],
  },
  {
    id: "gemini-pro-preview",
    label: "Gemini 3 Pro Preview",
    priceLabel: "0.2 元/次",
    description: "Nano Banana Pro 失败后的自动回退模型。",
    baseModel: "gemini-3-pro-image-preview",
    requestStrategy: "edits-model-name",
    selectable: false,
  },
];

export const RESOLUTION_OPTIONS: ResolutionOption[] = [
  {
    id: "1k",
    label: "1K",
    description: "极速，适合快速预览。",
  },
  {
    id: "2k",
    label: "2K",
    description: "平衡，默认清晰度。",
  },
  {
    id: "4k",
    label: "4K",
    description: "较慢，适合精细输出。",
  },
];

export const DEFAULT_MODEL_FAMILY_ID = MODEL_FAMILY_OPTIONS[0].id;
export const DEFAULT_RESOLUTION_ID = "2k";

export const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: "layout-preserve",
    name: "文字本地化并保留版式",
    summary: "优先翻译替字，尽量保留原图构图与字位。",
    focus: "text-localization",
  },
  {
    id: "localized-beauty",
    name: "本地化 + 主图美化",
    summary: "在翻译基础上提升质感与电商吸引力。",
    focus: "localized-beauty",
  },
  {
    id: "sales-booster",
    name: "本地化 + 卖点强化",
    summary: "增强卖点层级与可读性，不虚构功能参数。",
    focus: "sales-booster",
  },
];

export const DEFAULT_PRESET_ID = "localized-beauty";

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: "English", label: "English（英语）" },
  { value: "Deutsch", label: "Deutsch（德语）" },
  { value: "Français", label: "Français（法语）" },
  { value: "Español", label: "Español（西班牙语）" },
  { value: "Italiano", label: "Italiano（意大利语）" },
  { value: "Português", label: "Português（葡萄牙语）" },
  { value: "Polski", label: "Polski（波兰语）" },
  { value: "Nederlands", label: "Nederlands（荷兰语）" },
  { value: "日本語", label: "日本語（日语）" },
  { value: "한국어", label: "한국어（韩语）" },
  { value: "简体中文", label: "简体中文（简体中文）" },
  { value: "繁體中文", label: "繁體中文（繁体中文）" },
  { value: "Türkçe", label: "Türkçe（土耳其语）" },
  { value: "Русский", label: "Русский（俄语）" },
  { value: "ไทย", label: "ไทย（泰语）" },
  { value: "Tiếng Việt", label: "Tiếng Việt（越南语）" },
  { value: "Filipino", label: "Filipino（菲律宾语）" },
  { value: "Bahasa Malaysia", label: "Bahasa Malaysia（马来西亚语）" },
  { value: "العربية", label: "العربية（阿拉伯语）" },
];

export const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  {
    id: "1:1",
    label: "1:1（方图）",
    description: "适合通用主图与宫格展示。",
    aspectRatio: "1 / 1",
  },
  {
    id: "4:5",
    label: "4:5（竖版）",
    description: "适合信息流和移动端卡片。",
    aspectRatio: "4 / 5",
  },
  {
    id: "3:4",
    label: "3:4（竖版）",
    description: "适合人物感更强的海报展示。",
    aspectRatio: "3 / 4",
  },
  {
    id: "2:3",
    label: "2:3（竖版）",
    description: "适合需要更高纵向空间的编辑模型输出。",
    aspectRatio: "2 / 3",
  },
  {
    id: "4:3",
    label: "4:3（标准横版）",
    description: "适合常规主图场景，默认更稳妥。",
    aspectRatio: "4 / 3",
  },
  {
    id: "3:2",
    label: "3:2（横版）",
    description: "适合强调场景感和环境信息。",
    aspectRatio: "3 / 2",
  },
  {
    id: "16:9",
    label: "16:9（宽横版）",
    description: "适合横幅、首屏和广告素材。",
    aspectRatio: "16 / 9",
  },
];

export const DEFAULT_ASPECT_RATIO_ID = "1:1";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_REMOTE_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_HTML_BYTES = 2.5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
