import assert from "node:assert/strict";
import test from "node:test";

import { requestImageGeneration } from "@/lib/image-generation-request";

test("requestImageGeneration retries Nano Banana once after a transient fetch failure", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let callCount = 0;

  const result = await requestImageGeneration({
    apiKey: "test-key",
    prompt: "localize the hero image",
    modelFamilyId: "nano-banana",
    resolutionId: "1k",
    aspectRatioId: "1:1",
    sourceFile: new File(["image-bytes"], "hero.png", { type: "image/png" }),
    fetchImpl: async (input, init) => {
      calls.push({ url: String(input), init });
      callCount += 1;

      if (callCount === 1) {
        throw new TypeError("Failed to fetch");
      }

      return new Response(
        JSON.stringify({
          data: [{ url: "https://cdn.example.com/nano-banana-result.png" }],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(result.attempt.familyId, "nano-banana");
  assert.equal(result.attempt.model, "nano-banana");
  assert.equal(result.requestedModel, "nano-banana");
  assert.equal(result.payload.data?.[0]?.url, "https://cdn.example.com/nano-banana-result.png");

  const requestBody = calls[1]?.init?.body;
  assert.ok(requestBody instanceof FormData);
  assert.equal(requestBody.get("model"), "nano-banana");
  assert.equal(requestBody.get("aspect_ratio"), "1:1");
});

test("requestImageGeneration does not retry non-Nano Banana network failures", async () => {
  let callCount = 0;

  await assert.rejects(
    () =>
      requestImageGeneration({
        apiKey: "test-key",
        prompt: "localize the hero image",
        modelFamilyId: "gemini-flash",
        resolutionId: "1k",
        aspectRatioId: "1:1",
        sourceFile: new File(["image-bytes"], "hero.png", { type: "image/png" }),
        fetchImpl: async () => {
          callCount += 1;
          throw new TypeError("Failed to fetch");
        },
      }),
    /Failed to fetch/,
  );

  assert.equal(callCount, 1);
});
