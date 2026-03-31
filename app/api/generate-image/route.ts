import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { AppError, getErrorMessage } from "@/lib/app-error";
import { downloadRemoteImageAsFile } from "@/lib/extract-images";
import { generateEditedImage } from "@/lib/gpt-best";
import { buildGenerationPrompt } from "@/lib/prompt";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateImageSchema } from "@/lib/validation";

export const runtime = "nodejs";

const GENERATE_LIMIT = 12;
const GENERATE_WINDOW_MS = 60 * 60 * 1000;

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "anonymous";
  }

  return request.headers.get("x-real-ip")?.trim() || "anonymous";
}

function validateUploadedFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new AppError("图片格式不受支持，仅支持 JPG、PNG、WEBP、AVIF。", 415);
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new AppError("上传图片体积过大，请控制在 10MB 以内。", 413);
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limitState = checkRateLimit(ip, GENERATE_LIMIT, GENERATE_WINDOW_MS);
  const headers = new Headers({
    "X-RateLimit-Limit": String(GENERATE_LIMIT),
    "X-RateLimit-Remaining": String(limitState.remaining),
    "X-RateLimit-Reset": String(limitState.resetAt),
  });

  if (!limitState.allowed) {
    return NextResponse.json(
      {
        error: "当前请求频率过高，请稍后再试。",
      },
      {
        status: 429,
        headers,
      },
    );
  }

  try {
    const formData = await request.formData();
    const fileEntry = formData.get("image");

    const parsed = generateImageSchema.parse({
      sourceLanguage: String(formData.get("sourceLanguage") ?? ""),
      targetLanguage: String(formData.get("targetLanguage") ?? ""),
      presetId: String(formData.get("presetId") ?? ""),
      customPrompt: String(formData.get("customPrompt") ?? ""),
      model: String(formData.get("model") ?? ""),
      remoteImageUrl: String(formData.get("remoteImageUrl") ?? ""),
    });

    let sourceFile: File | null = null;

    if (fileEntry instanceof File && fileEntry.size > 0) {
      validateUploadedFile(fileEntry);
      sourceFile = fileEntry;
    } else if (parsed.remoteImageUrl?.trim()) {
      sourceFile = await downloadRemoteImageAsFile(parsed.remoteImageUrl.trim());
    }

    if (!sourceFile) {
      throw new AppError("请先上传图片或选择候选图。", 400);
    }

    const prompt = buildGenerationPrompt({
      sourceLanguage: parsed.sourceLanguage?.trim() || undefined,
      targetLanguage: parsed.targetLanguage.trim(),
      presetId: parsed.presetId,
      customPrompt: parsed.customPrompt?.trim() || undefined,
    });

    const result = await generateEditedImage({
      file: sourceFile,
      modelId: parsed.model,
      prompt,
    });

    return NextResponse.json(result, { headers });
  } catch (error) {
    const status =
      error instanceof AppError ? error.status : error instanceof ZodError ? 400 : 500;

    return NextResponse.json(
      {
        error:
          error instanceof ZodError
            ? error.issues[0]?.message ?? "请求参数不合法。"
            : getErrorMessage(error, "图片生成失败，请稍后重试。"),
      },
      {
        status,
        headers,
      },
    );
  }
}
