import { NextRequest, NextResponse } from "next/server";

import { getErrorMessage } from "@/lib/app-error";
import { requestImageGeneration } from "@/lib/image-generation-request";
import { ASPECT_RATIO_IDS, MODEL_FAMILY_IDS, RESOLUTION_IDS } from "@/lib/types";
import type { AspectRatioId, ModelFamilyId, ResolutionId } from "@/lib/types";

export const runtime = "nodejs";

function parseApiKey(request: NextRequest) {
  const authorization = request.headers.get("authorization")?.trim();

  if (!authorization) {
    return "";
  }

  return authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : authorization;
}

function isModelFamilyId(value: string): value is ModelFamilyId {
  return MODEL_FAMILY_IDS.includes(value as ModelFamilyId);
}

function isResolutionId(value: string): value is ResolutionId {
  return RESOLUTION_IDS.includes(value as ResolutionId);
}

function isAspectRatioId(value: string): value is AspectRatioId {
  return ASPECT_RATIO_IDS.includes(value as AspectRatioId);
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = parseApiKey(request);

    if (!apiKey) {
      return NextResponse.json({ error: "缺少 API Key，请先完成本地设置。" }, { status: 400 });
    }

    const formData = await request.formData();
    const prompt = `${formData.get("prompt") ?? ""}`.trim();
    const modelFamilyId = `${formData.get("modelFamilyId") ?? ""}`.trim();
    const resolutionId = `${formData.get("resolutionId") ?? ""}`.trim();
    const aspectRatioId = `${formData.get("aspectRatioId") ?? ""}`.trim();
    const image = formData.get("image");

    if (!prompt) {
      return NextResponse.json({ error: "生成提示词不能为空。" }, { status: 400 });
    }

    if (!isModelFamilyId(modelFamilyId)) {
      return NextResponse.json({ error: "模型参数无效。" }, { status: 400 });
    }

    if (!isResolutionId(resolutionId)) {
      return NextResponse.json({ error: "分辨率参数无效。" }, { status: 400 });
    }

    if (!isAspectRatioId(aspectRatioId)) {
      return NextResponse.json({ error: "画面比例参数无效。" }, { status: 400 });
    }

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "缺少可用图片文件。" }, { status: 400 });
    }

    const generationResult = await requestImageGeneration({
      apiKey,
      prompt,
      modelFamilyId,
      resolutionId,
      aspectRatioId,
      sourceFile: image,
    });

    return NextResponse.json(generationResult, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "图片生成失败，请稍后重试。") },
      { status: 500 },
    );
  }
}
