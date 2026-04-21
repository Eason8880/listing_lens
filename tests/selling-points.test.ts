import test from "node:test";
import assert from "node:assert/strict";

import { parseSellingPoints } from "@/lib/selling-points";

test("parseSellingPoints keeps hyphenated english phrases intact before arrow translations", () => {
  const items = parseSellingPoints(
    [
      "ULTRA - FINE HERB MINCING → 超细香草切碎",
      "EASY - TWIST DESIGN → 轻松旋转设计",
      "PRESERVES FRESH FLAVOR - 保留新鲜风味",
    ].join("\n"),
  );

  assert.deepEqual(items, [
    { target: "ULTRA - FINE HERB MINCING", zh: "超细香草切碎" },
    { target: "EASY - TWIST DESIGN", zh: "轻松旋转设计" },
    { target: "PRESERVES FRESH FLAVOR", zh: "保留新鲜风味" },
  ]);
});

test("parseSellingPoints merges english fragments that spill across multiple lines", () => {
  const items = parseSellingPoints(
    [
      "ULTRA",
      "EASY",
      "PRESERVES FRESH FLAVOR → 保留新鲜风味",
    ].join("\n"),
  );

  assert.deepEqual(items, [
    { target: "ULTRA EASY PRESERVES FRESH FLAVOR", zh: "保留新鲜风味" },
  ]);
});

test("parseSellingPoints returns an empty list for explicit no-text responses", () => {
  assert.deepEqual(parseSellingPoints("未检测到卖点文字"), []);
});
