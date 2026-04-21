import type { ModelFamilyId } from "@/lib/types";

const NANO_BANANA_NOTICE =
  "default 分组不可用时建议增加 gemini优质分组，注意价格是当前显示价格的 2 倍。";

export function getModelFamilySelectionNotice(modelFamilyId: ModelFamilyId) {
  switch (modelFamilyId) {
    case "gemini-flash":
    case "nano-banana":
    case "nano-banana-pro":
      return NANO_BANANA_NOTICE;
    default:
      return "";
  }
}
