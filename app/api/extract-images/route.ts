import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError, getErrorMessage } from "@/lib/app-error";
import { fetchProductImages } from "@/lib/extract-images";
import { extractImagesSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productUrl } = extractImagesSchema.parse(body);
    const images = await fetchProductImages(productUrl);

    return NextResponse.json({ images });
  } catch (error) {
    const status =
      error instanceof AppError ? error.status : error instanceof ZodError ? 400 : 500;

    return NextResponse.json(
      {
        images: [],
        error:
          error instanceof ZodError
            ? error.issues[0]?.message ?? "请求参数不合法。"
            : getErrorMessage(error, "候选图抓取失败，请稍后重试。"),
      },
      { status },
    );
  }
}
