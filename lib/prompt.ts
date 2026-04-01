import { PROMPT_PRESETS } from "@/lib/constants";
import { AppError } from "@/lib/app-error";
import type { PromptPresetId } from "@/lib/types";

interface BuildGenerationPromptInput {
  sourceLanguage?: string;
  targetLanguage: string;
  aspectRatio?: string;
  presetId: PromptPresetId;
  customPrompt?: string;
}

const PRESET_INSTRUCTIONS: Record<PromptPresetId, string> = {
  "layout-preserve":
    "Keep the original composition, text placement, badge positions, spacing rhythm, and product hierarchy as close as possible while translating the existing text.",
  "localized-beauty":
    "Maintain the original composition while subtly enhancing lighting, clarity, contrast, and premium ecommerce appeal so the hero image feels polished and market-ready.",
  "sales-booster":
    "Improve headline readability, information hierarchy, and conversion-focused emphasis while staying faithful to the original product and avoiding unsupported marketing claims.",
};

export function buildGenerationPrompt({
  sourceLanguage,
  targetLanguage,
  aspectRatio,
  presetId,
  customPrompt,
}: BuildGenerationPromptInput) {
  const preset = PROMPT_PRESETS.find((item) => item.id === presetId);

  if (!preset) {
    throw new AppError("未找到对应的预设提示词。", 400);
  }

  const languageInstruction = sourceLanguage?.trim()
    ? `Translate every visible marketing text from ${sourceLanguage.trim()} into ${targetLanguage.trim()}.`
    : `Detect whether the image contains existing text. If it does, translate the original text into ${targetLanguage.trim()}. If it does not, do not invent unnecessary text.`;

  const customInstruction = customPrompt?.trim()
    ? `Additional request from the merchant: ${customPrompt.trim()}`
    : "No extra merchant instructions were provided.";
  const aspectRatioInstruction = aspectRatio?.trim()
    ? `The final output canvas must be exactly ${aspectRatio.trim()}. If the source image does not naturally fit, expand background, crop non-essential margins, or rebalance whitespace while keeping the product fully visible and commercially centered.`
    : "Keep an ecommerce-friendly output framing that stays faithful to the original composition.";

  return [
    "You are editing a cross-border ecommerce product hero image.",
    "Preserve the exact product identity, color, material, quantity, packaging, proportions, and factual claims.",
    "Do not remove important product details or add unsupported accessories, claims, or certifications.",
    "Keep the product as the clear focal point and maintain a clean marketplace-ready composition.",
    languageInstruction,
    PRESET_INSTRUCTIONS[presetId],
    aspectRatioInstruction,
    "When text exists, replace the original wording with natural, market-appropriate copy in the target language while preserving the original visual hierarchy as much as possible.",
    "When the image has no text, focus on tasteful hero-image enhancement only and avoid forcing labels or extra wording.",
    "Improve overall readability and commercial appeal, but avoid excessive hallucinated redesign.",
    customInstruction,
  ].join("\n");
}
