import test from "node:test";
import assert from "node:assert/strict";

import { buildGenerationPrompt } from "@/lib/prompt";

test("buildGenerationPrompt includes auto-detect behavior when source language is empty", () => {
  const prompt = buildGenerationPrompt({
    targetLanguage: "English",
    aspectRatio: "4:3",
    presetId: "localized-beauty",
  });

  assert.match(prompt, /Detect whether the image contains existing text/i);
  assert.match(prompt, /English/);
  assert.match(prompt, /must be exactly 4:3/i);
  assert.match(prompt, /premium ecommerce appeal/i);
});

test("buildGenerationPrompt uses explicit source language when provided", () => {
  const prompt = buildGenerationPrompt({
    sourceLanguage: "简体中文",
    targetLanguage: "Deutsch",
    aspectRatio: "1:1",
    presetId: "layout-preserve",
    customPrompt: "Keep the packaging visible.",
  });

  assert.match(prompt, /from 简体中文 into Deutsch/i);
  assert.match(prompt, /Keep the packaging visible/i);
  assert.match(prompt, /must be exactly 1:1/i);
  assert.match(prompt, /Keep the original composition/i);
});

test("buildGenerationPrompt makes angle adjustment a visible change when enabled", () => {
  const prompt = buildGenerationPrompt({
    targetLanguage: "Español",
    aspectRatio: "4:3",
    presetId: "localized-beauty",
    adjustProductAngle: true,
  });

  assert.match(prompt, /adjust the viewing angle or perspective/i);
  assert.match(prompt, /must be visibly different from the source image/i);
  assert.match(prompt, /do not keep the same camera angle/i);
  assert.match(prompt, /angle change takes priority over preserving the original composition/i);
});

test("buildGenerationPrompt adds a product-info background instruction without overlay text", () => {
  const prompt = buildGenerationPrompt({
    targetLanguage: "English",
    aspectRatio: "4:3",
    presetId: "localized-beauty",
    matchBackgroundToProductInfo: true,
  });

  assert.match(prompt, /background and scene that fit the product's use case/i);
  assert.match(prompt, /keep the product itself unchanged/i);
  assert.match(prompt, /do not add extra selling-point text or overlay copy/i);
});

test("buildGenerationPrompt keeps selling-point overlays separate from background matching", () => {
  const prompt = buildGenerationPrompt({
    targetLanguage: "English",
    aspectRatio: "4:3",
    presetId: "localized-beauty",
    extractSellingPoints: true,
  });

  assert.match(prompt, /overlay a few short, punchy English keywords or phrases/i);
  assert.doesNotMatch(prompt, /background and scene that fit the product's use case/i);
});

test("buildGenerationPrompt allows selling-point overlays even when the source image has no text", () => {
  const prompt = buildGenerationPrompt({
    targetLanguage: "English",
    aspectRatio: "1:1",
    presetId: "localized-beauty",
    extractSellingPoints: true,
  });

  assert.match(prompt, /even if the source image has no text, still add 3-5 short selling-point overlays/i);
  assert.doesNotMatch(prompt, /avoid forcing labels or extra wording/i);
});

test("buildGenerationPrompt makes background matching a visible change when enabled", () => {
  const prompt = buildGenerationPrompt({
    targetLanguage: "English",
    aspectRatio: "1:1",
    presetId: "localized-beauty",
    matchBackgroundToProductInfo: true,
  });

  assert.match(prompt, /background must be visibly different from the source image/i);
  assert.match(prompt, /do not keep the same plain studio background or identical scene/i);
  assert.match(prompt, /background change takes priority over preserving the original background/i);
});

test("buildGenerationPrompt omits preset instructions when generating without a source image", () => {
  const prompt = buildGenerationPrompt({
    targetLanguage: "Deutsch",
    aspectRatio: "1:1",
    presetId: "localized-beauty",
    customPrompt: "Create a premium waterproof lunch bag hero image with short headline text.",
    hasSourceImage: false,
  });

  assert.match(prompt, /generating a brand-new cross-border ecommerce product hero image/i);
  assert.match(prompt, /Create a premium waterproof lunch bag hero image/i);
  assert.doesNotMatch(prompt, /premium ecommerce appeal/i);
  assert.doesNotMatch(prompt, /Detect whether the image contains existing text/i);
  assert.doesNotMatch(prompt, /Deutsch/i);
});
