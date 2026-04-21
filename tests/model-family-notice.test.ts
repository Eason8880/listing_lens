import assert from "node:assert/strict";
import test from "node:test";

import { getModelFamilySelectionNotice } from "@/lib/model-family-notice";

test("getModelFamilySelectionNotice returns the gemini premium notice for Nano Banana families", () => {
  const expected =
    "default 分组不可用时建议增加 gemini优质分组，注意价格是当前显示价格的 2 倍。";

  assert.equal(getModelFamilySelectionNotice("gemini-flash"), expected);
  assert.equal(getModelFamilySelectionNotice("nano-banana"), expected);
  assert.equal(getModelFamilySelectionNotice("nano-banana-pro"), expected);
});

test("getModelFamilySelectionNotice returns an empty string for other model families", () => {
  assert.equal(getModelFamilySelectionNotice("doubao-seedream"), "");
  assert.equal(getModelFamilySelectionNotice("gpt-image-1-5"), "");
  assert.equal(getModelFamilySelectionNotice("gemini-pro-preview"), "");
});
