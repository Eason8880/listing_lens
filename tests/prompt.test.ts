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
  assert.match(prompt, /4:3 aspect ratio/i);
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
  assert.match(prompt, /1:1 aspect ratio/i);
  assert.match(prompt, /Keep the original composition/i);
});
