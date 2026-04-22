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

test("requestImageGeneration retries transient network failures and returns the localized network message", async () => {
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
    /网络请求失败，请检查网络连接后重试/,
  );

  assert.equal(callCount, 4);
});

test("requestImageGeneration sends text-only generations for GPT Image 2 when no source image is provided", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  const result = await requestImageGeneration({
    apiKey: "test-key",
    prompt: "Create a clean ecommerce hero image for a waterproof lunch bag.",
    modelFamilyId: "gpt-image-1-5",
    resolutionId: "2k",
    aspectRatioId: "1:1",
    fetchImpl: async (input, init) => {
      calls.push({ url: String(input), init });

      return new Response(
        JSON.stringify({
          data: [{ b64_json: "QUJD" }],
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

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://api.bltcy.ai/v1/images/generations");
  assert.equal(result.attempt.familyId, "gpt-image-1-5");
  assert.equal(result.attempt.size, "2048x2048");

  const requestBody = calls[0]?.init?.body;
  assert.equal(typeof requestBody, "string");

  const parsedBody = JSON.parse(requestBody as string) as Record<string, unknown>;

  assert.equal(parsedBody.model, "gpt-image-2");
  assert.equal(parsedBody.size, "2048x2048");
  assert.equal(parsedBody.response_format, "b64_json");
  assert.equal(parsedBody.image, undefined);
});
