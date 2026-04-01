import { z } from "zod";

import {
  ASPECT_RATIO_IDS,
  MODEL_FAMILY_IDS,
  PROMPT_PRESET_IDS,
  RESOLUTION_IDS,
} from "@/lib/types";

export const extractImagesSchema = z.object({
  productUrl: z.url("请输入有效的商品链接。"),
});

export const generateImageSchema = z.object({
  sourceLanguage: z.string().trim().max(40).optional().or(z.literal("")),
  targetLanguage: z.string().trim().min(1, "目标语言不能为空。").max(40),
  aspectRatio: z.enum(ASPECT_RATIO_IDS),
  presetId: z.enum(PROMPT_PRESET_IDS),
  customPrompt: z.string().trim().max(500).optional().or(z.literal("")),
  modelFamily: z.enum(MODEL_FAMILY_IDS),
  resolution: z.enum(RESOLUTION_IDS),
  remoteImageUrl: z.string().optional(),
});
