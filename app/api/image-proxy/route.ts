import { NextRequest, NextResponse } from "next/server";

import { AppError, getErrorMessage } from "@/lib/app-error";
import { fetchRemoteImageAsset } from "@/lib/extract-images";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const imageUrl = request.nextUrl.searchParams.get("url");

  if (!imageUrl) {
    return new NextResponse("Missing url parameter.", { status: 400 });
  }

  try {
    const asset = await fetchRemoteImageAsset(imageUrl);

    return new NextResponse(asset.bytes, {
      status: 200,
      headers: {
        "Content-Type": asset.contentType,
        "Content-Disposition": `inline; filename="${asset.filename}"`,
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;

    return new NextResponse(getErrorMessage(error, "图片代理失败。"), {
      status,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}
