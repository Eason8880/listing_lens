import { load } from "cheerio";

import {
  ALLOWED_IMAGE_TYPES,
  MAX_HTML_BYTES,
  MAX_REMOTE_IMAGE_BYTES,
} from "@/lib/constants";
import { AppError } from "@/lib/app-error";
import { ensureSafeHttpUrl } from "@/lib/ssrf";
import type { ExtractedImageCandidate } from "@/lib/types";

const REMOTE_IMAGE_ACCEPT_HEADER = "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8";
const REMOTE_FETCH_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function toAbsoluteUrl(baseUrl: string, candidate: string | undefined | null) {
  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();

  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("javascript:")) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, baseUrl);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeForDedupe(url: string) {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.searchParams.sort();
  return `${parsed.origin}${parsed.pathname}`;
}

function readDimension(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function scoreCandidate(candidate: ExtractedImageCandidate) {
  let score = 0;
  const lowerSource = candidate.source.toLowerCase();
  const lowerUrl = candidate.url.toLowerCase();

  if (lowerSource.includes("amazon")) score += 130;
  if (lowerSource.includes("json-ld")) score += 120;
  if (lowerSource.includes("og:image")) score += 110;
  if (lowerSource.includes("gallery")) score += 80;
  if (lowerSource.includes("generic")) score += 40;

  if (candidate.width && candidate.height) {
    score += Math.min(Math.round((candidate.width * candidate.height) / 50000), 40);
  }

  if (/(hero|main|primary|product|large|hires|highres|zoom)/.test(lowerUrl)) {
    score += 25;
  }

  if (/(thumb|thumbnail|icon|logo|avatar|spacer|swatch)/.test(lowerUrl)) {
    score -= 40;
  }

  return score;
}

function addCandidate(
  list: ExtractedImageCandidate[],
  dedupe: Set<string>,
  candidate: ExtractedImageCandidate | null,
) {
  if (!candidate) {
    return;
  }

  const key = normalizeForDedupe(candidate.url);

  if (dedupe.has(key)) {
    const existing = list.find((item) => normalizeForDedupe(item.url) === key);

    if (existing) {
      existing.width ??= candidate.width;
      existing.height ??= candidate.height;

      if (existing.source.startsWith("generic") && !candidate.source.startsWith("generic")) {
        existing.source = candidate.source;
      }
    }

    return;
  }

  dedupe.add(key);
  list.push(candidate);
}

function parseStructuredProductImages(html: string, pageUrl: string) {
  const $ = load(html);
  const images: ExtractedImageCandidate[] = [];
  const dedupe = new Set<string>();

  $('script[type="application/ld+json"]').each((_, element) => {
    const content = $(element).text().trim();

    if (!content) {
      return;
    }

    try {
      const payload = JSON.parse(content);
      const queue = Array.isArray(payload) ? [...payload] : [payload];

      while (queue.length) {
        const item = queue.shift();

        if (!item || typeof item !== "object") {
          continue;
        }

        if (Array.isArray(item)) {
          queue.push(...item);
          continue;
        }

        for (const value of Object.values(item)) {
          if (value && typeof value === "object") {
            queue.push(value);
          }
        }

        const imageValue = Reflect.get(item, "image") ?? Reflect.get(item, "images");

        if (!imageValue) {
          continue;
        }

        const imageList = Array.isArray(imageValue) ? imageValue : [imageValue];

        for (const imageItem of imageList) {
          if (typeof imageItem === "string") {
            const absolute = toAbsoluteUrl(pageUrl, imageItem);
            addCandidate(images, dedupe, absolute ? { url: absolute, source: "json-ld-product" } : null);
            continue;
          }

          if (imageItem && typeof imageItem === "object") {
            const absolute = toAbsoluteUrl(
              pageUrl,
              Reflect.get(imageItem, "url")?.toString() ?? Reflect.get(imageItem, "contentUrl")?.toString(),
            );

            addCandidate(
              images,
              dedupe,
              absolute
                ? {
                    url: absolute,
                    source: "json-ld-product",
                    width: readDimension(Reflect.get(imageItem, "width")?.toString()),
                    height: readDimension(Reflect.get(imageItem, "height")?.toString()),
                  }
                : null,
            );
          }
        }
      }
    } catch {
      // Ignore malformed JSON-LD blocks and keep extracting from the rest of the page.
    }
  });

  return images;
}

export function extractImageCandidatesFromHtml(html: string, pageUrl: string) {
  const $ = load(html);
  const candidates: ExtractedImageCandidate[] = [];
  const dedupe = new Set<string>();

  const metaSelectors = [
    { selector: 'meta[property="og:image"]', source: "og:image" },
    { selector: 'meta[name="twitter:image"]', source: "twitter:image" },
  ];

  for (const meta of metaSelectors) {
    $(meta.selector).each((_, element) => {
      const absolute = toAbsoluteUrl(pageUrl, $(element).attr("content"));
      addCandidate(candidates, dedupe, absolute ? { url: absolute, source: meta.source } : null);
    });
  }

  for (const structured of parseStructuredProductImages(html, pageUrl)) {
    addCandidate(candidates, dedupe, structured);
  }

  $("#landingImage").each((_, element) => {
    const dataOldHires = $(element).attr("data-old-hires");
    const dynamicImage = $(element).attr("data-a-dynamic-image");
    const primarySrc = $(element).attr("src");

    for (const value of [dataOldHires, primarySrc]) {
      const absolute = toAbsoluteUrl(pageUrl, value);
      addCandidate(candidates, dedupe, absolute ? { url: absolute, source: "amazon-gallery" } : null);
    }

    if (dynamicImage) {
      try {
        const parsed = JSON.parse(dynamicImage) as Record<string, [number, number]>;

        for (const [url, dimensions] of Object.entries(parsed)) {
          const absolute = toAbsoluteUrl(pageUrl, url);
          addCandidate(
            candidates,
            dedupe,
            absolute
              ? {
                  url: absolute,
                  source: "amazon-gallery",
                  width: dimensions?.[0],
                  height: dimensions?.[1],
                }
              : null,
          );
        }
      } catch {
        // Ignore malformed Amazon dynamic image payloads.
      }
    }
  });

  const attributeCandidates = [
    { selector: 'img[src]', attribute: "src", source: "generic-img" },
    { selector: 'img[data-src]', attribute: "data-src", source: "generic-data-src" },
    { selector: 'img[data-zoom-image]', attribute: "data-zoom-image", source: "gallery-zoom" },
    { selector: 'img[data-large-image]', attribute: "data-large-image", source: "gallery-large" },
    { selector: '[data-product-feature-name="main-image"] img', attribute: "src", source: "amazon-main-image" },
    { selector: '.product__media img', attribute: "src", source: "shopify-gallery" },
    { selector: '.Product__Slideshow img', attribute: "src", source: "shopify-gallery" },
    { selector: '.images-view-item img', attribute: "src", source: "aliexpress-gallery" },
    { selector: '[data-testid*="product-image"] img', attribute: "src", source: "temu-gallery" },
  ];

  for (const item of attributeCandidates) {
    $(item.selector).each((_, element) => {
      const absolute = toAbsoluteUrl(pageUrl, $(element).attr(item.attribute));
      addCandidate(
        candidates,
        dedupe,
        absolute
          ? {
              url: absolute,
              source: item.source,
              width: readDimension($(element).attr("width")),
              height: readDimension($(element).attr("height")),
            }
          : null,
      );
    });
  }

  candidates.sort((a, b) => scoreCandidate(b) - scoreCandidate(a));

  return candidates.slice(0, 12);
}

export async function fetchProductImages(productUrl: string) {
  const safeUrl = await ensureSafeHttpUrl(productUrl);
  const response = await fetch(safeUrl, {
    headers: {
      "user-agent": REMOTE_FETCH_USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new AppError(`抓取商品页失败，目标站点返回 ${response.status}。`, 502);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const contentLength = Number(response.headers.get("content-length") ?? 0);

  if (contentLength && contentLength > MAX_HTML_BYTES) {
    throw new AppError("商品页内容过大，暂不支持解析。", 413);
  }

  if (contentType.startsWith("image/")) {
    return [
      {
        url: safeUrl.toString(),
        source: "direct-image",
      },
    ] satisfies ExtractedImageCandidate[];
  }

  const html = await response.text();

  if (html.length > MAX_HTML_BYTES) {
    throw new AppError("商品页内容过大，暂不支持解析。", 413);
  }

  return extractImageCandidatesFromHtml(html, safeUrl.toString());
}

function buildRemoteImageHeaders(url: URL) {
  return {
    accept: REMOTE_IMAGE_ACCEPT_HEADER,
    "user-agent": REMOTE_FETCH_USER_AGENT,
    referer: `${url.origin}/`,
    origin: url.origin,
  };
}

export async function fetchRemoteImageAsset(imageUrl: string) {
  const safeUrl = await ensureSafeHttpUrl(imageUrl);
  const response = await fetch(safeUrl, {
    headers: buildRemoteImageHeaders(safeUrl),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new AppError(`远程图片下载失败，目标站点返回 ${response.status}。`, 502);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new AppError("远程图片格式不受支持，仅支持 JPG、PNG、WEBP、AVIF。", 415);
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);

  if (contentLength && contentLength > MAX_REMOTE_IMAGE_BYTES) {
    throw new AppError("远程图片体积过大，请改为手动上传压缩后的图片。", 413);
  }

  const bytes = await response.arrayBuffer();

  if (bytes.byteLength > MAX_REMOTE_IMAGE_BYTES) {
    throw new AppError("远程图片体积过大，请改为手动上传压缩后的图片。", 413);
  }

  const pathname = safeUrl.pathname.split("/").pop() || "remote-image";
  const extension = contentType.split("/")[1] ?? "png";
  const filename = pathname.includes(".") ? pathname : `${pathname}.${extension}`;

  return {
    bytes,
    contentType,
    filename,
  };
}

export async function downloadRemoteImageAsFile(imageUrl: string) {
  const asset = await fetchRemoteImageAsset(imageUrl);

  return new File([asset.bytes], asset.filename, { type: asset.contentType });
}
