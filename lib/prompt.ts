import { PROMPT_PRESETS } from "@/lib/constants";
import { AppError } from "@/lib/app-error";
import type { PromptPresetId } from "@/lib/types";

interface BuildGenerationPromptInput {
  sourceLanguage?: string;
  targetLanguage: string;
  aspectRatio?: string;
  presetId: PromptPresetId;
  customPrompt?: string;
  hasSourceImage?: boolean;
  extractSellingPoints?: boolean;
  adjustProductAngle?: boolean;
  matchBackgroundToProductInfo?: boolean;
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
  hasSourceImage = true,
  extractSellingPoints,
  adjustProductAngle,
  matchBackgroundToProductInfo,
}: BuildGenerationPromptInput) {
  const trimmedTargetLanguage = targetLanguage.trim();
  const trimmedCustomPrompt = customPrompt?.trim();

  if (!hasSourceImage && !trimmedCustomPrompt) {
    throw new AppError("无图片时必须填写补充说明。", 400);
  }

  if (!hasSourceImage) {
    const languageInstruction = extractSellingPoints
      ? "If you add any overlay copy, keep it to 3-5 short selling-point phrases."
      : "Create visible marketing copy only when it improves the ecommerce composition, and keep it minimal.";
    const aspectRatioInstruction = aspectRatio?.trim()
      ? `The final output canvas must be exactly ${aspectRatio.trim()}. Compose the scene natively for that ratio.`
      : "Use an ecommerce-friendly output framing.";
    const adjustAngleInstruction = adjustProductAngle
      ? "Choose a deliberate, commercially effective product viewing angle rather than a flat catalog-style front view."
      : null;
    const backgroundMatchInstruction = matchBackgroundToProductInfo
      ? [
          "Choose a background and scene that fit the product's use case, material, and merchandising context.",
          "Keep the composition marketplace-ready and visually coherent.",
        ].join(" ")
      : null;
    const sellingPointsInstruction = extractSellingPoints
      ? "Add a few short, punchy selling-point overlays only when they are directly supported by the merchant instruction."
      : null;

    return [
      "You are generating a brand-new cross-border ecommerce product hero image.",
      "Use only the merchant instruction as the source of truth for product details, materials, packaging, and claims.",
      "Do not invent unsupported accessories, certifications, specifications, or marketing claims.",
      "Keep the product as the clear focal point and maintain a clean marketplace-ready composition.",
      languageInstruction,
      adjustAngleInstruction,
      sellingPointsInstruction,
      backgroundMatchInstruction,
      aspectRatioInstruction,
      `Additional request from the merchant: ${trimmedCustomPrompt}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const preset = PROMPT_PRESETS.find((item) => item.id === presetId);

  if (!preset) {
    throw new AppError("未找到对应的预设提示词。", 400);
  }

  const languageInstruction = sourceLanguage?.trim()
    ? `Translate every visible marketing text from ${sourceLanguage.trim()} into ${trimmedTargetLanguage}.`
    : extractSellingPoints
      ? `Detect whether the image contains existing text. If it does, translate the original text into ${trimmedTargetLanguage}. If it does not, you may still add the requested selling-point overlays in ${trimmedTargetLanguage}, but do not invent unrelated claims or long paragraphs.`
      : `Detect whether the image contains existing text. If it does, translate the original text into ${trimmedTargetLanguage}. If it does not, do not invent unnecessary text.`;

  const customInstruction = trimmedCustomPrompt
    ? `Additional request from the merchant: ${trimmedCustomPrompt}`
    : "No extra merchant instructions were provided.";
  const sellingPointsInstruction = extractSellingPoints
    ? `Extract the product's core selling points from the image and overlay a few short, punchy ${trimmedTargetLanguage} keywords or phrases (no more than 3–5 items, each under 5 words) directly on the output. Keep text minimal — the goal is to accent selling points and beautify the image, not to cover it with paragraphs. Use clear visual hierarchy, appropriate font weight contrast, and harmonious placement that enhances rather than clutters the composition. The product must remain the dominant visual element. Even if the source image has no text, still add 3-5 short selling-point overlays in ${trimmedTargetLanguage} based on the visible product attributes and use case.`
    : null;
  const aspectRatioInstruction = aspectRatio?.trim()
    ? `The final output canvas must be exactly ${aspectRatio.trim()}. If the source image does not naturally fit, expand background, crop non-essential margins, or rebalance whitespace while keeping the product fully visible and commercially centered.`
    : "Keep an ecommerce-friendly output framing that stays faithful to the original composition.";

  const adjustAngleInstruction = adjustProductAngle
    ? [
        "Adjust the viewing angle or perspective of the product so the output must be visibly different from the source image in a side-by-side comparison.",
        "Do not keep the same camera angle, same product tilt, or same viewpoint as the source image.",
        "Angle change takes priority over preserving the original composition or matching the original layout exactly.",
        "Only the shooting angle or perspective may change. Keep all product details, materials, colors, branding, proportions, and factual accuracy completely unchanged.",
      ].join(" ")
    : null;
  const backgroundMatchInstruction = matchBackgroundToProductInfo
    ? [
        "Choose a background and scene that fit the product's use case, material, and merchandising context.",
        "The background must be visibly different from the source image in a side-by-side comparison.",
        "Do not keep the same plain studio background or identical scene as the source image.",
        "Background change takes priority over preserving the original background or scene exactly.",
        "Keep the product itself unchanged while adapting only the background, environment, props, and scene atmosphere.",
        "Do not add extra selling-point text or overlay copy unless explicitly requested elsewhere.",
      ].join(" ")
    : null;
  const noTextInstruction = extractSellingPoints
    ? "When the image has no text and selling-point overlays are requested, still add the requested short overlay phrases in the target language rather than leaving the image text-free."
    : "When the image has no text, focus on tasteful hero-image enhancement only and avoid forcing labels or extra wording.";

  return [
    "You are editing a cross-border ecommerce product hero image.",
    "Preserve the exact product identity, color, material, quantity, packaging, proportions, and factual claims.",
    "Do not remove important product details or add unsupported accessories, claims, or certifications.",
    "Keep the product as the clear focal point and maintain a clean marketplace-ready composition.",
    languageInstruction,
    PRESET_INSTRUCTIONS[presetId],
    adjustAngleInstruction,
    sellingPointsInstruction,
    backgroundMatchInstruction,
    aspectRatioInstruction,
    "When text exists, replace the original wording with natural, market-appropriate copy in the target language while preserving the original visual hierarchy as much as possible.",
    noTextInstruction,
    "Improve overall readability and commercial appeal, but avoid excessive hallucinated redesign.",
    customInstruction,
  ]
    .filter(Boolean)
    .join("\n");
}
