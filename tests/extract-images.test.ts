import test from "node:test";
import assert from "node:assert/strict";

import { extractImageCandidatesFromHtml } from "@/lib/extract-images";

test("extractImageCandidatesFromHtml reads og:image and JSON-LD product images", () => {
  const html = `
    <html>
      <head>
        <meta property="og:image" content="/images/hero-main.jpg" />
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "image": [
              "https://cdn.example.com/product/detail-1.jpg",
              "https://cdn.example.com/product/detail-2.jpg"
            ]
          }
        </script>
      </head>
      <body>
        <img src="/images/thumb-small.jpg" width="120" height="120" />
      </body>
    </html>
  `;

  const candidates = extractImageCandidatesFromHtml(html, "https://shop.example.com/product/sku-1");

  assert.ok(candidates.some((item) => item.url === "https://shop.example.com/images/hero-main.jpg"));
  assert.ok(
    candidates.some((item) => item.url === "https://cdn.example.com/product/detail-1.jpg"),
  );
});

test("extractImageCandidatesFromHtml parses Amazon dynamic image payloads", () => {
  const html = `
    <html>
      <body>
        <img
          id="landingImage"
          data-old-hires="https://images-na.ssl-images-amazon.com/images/I/hero.jpg"
          data-a-dynamic-image='{"https://images-na.ssl-images-amazon.com/images/I/hero.jpg":[2000,2000],"https://images-na.ssl-images-amazon.com/images/I/alt.jpg":[800,800]}'
        />
      </body>
    </html>
  `;

  const candidates = extractImageCandidatesFromHtml(html, "https://www.amazon.com/dp/B000000001");

  assert.ok(
    candidates.some(
      (item) =>
        item.url === "https://images-na.ssl-images-amazon.com/images/I/hero.jpg" &&
        item.width === 2000 &&
        item.height === 2000,
    ),
  );
});
