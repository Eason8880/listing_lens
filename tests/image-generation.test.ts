import test from "node:test";
import assert from "node:assert/strict";

async function requireImageGenerationModule() {
  const imageGenerationModule = await import("@/lib/image-generation").catch(() => null);
  assert.ok(imageGenerationModule, "Expected @/lib/image-generation to exist.");
  return imageGenerationModule;
}

test("all model family price labels use 元/张 wording", async () => {
  const constantsModule = await import("@/lib/constants").catch(() => null);
  assert.ok(constantsModule, "Expected @/lib/constants to exist.");

  const { MODEL_FAMILY_OPTIONS } = constantsModule;

  for (const modelFamily of MODEL_FAMILY_OPTIONS) {
    assert.match(
      modelFamily.priceLabel,
      /元\/张$/,
      `Expected ${modelFamily.id} base price label to use 元/张 wording.`,
    );

    for (const priceLabel of Object.values(modelFamily.priceLabelByResolution ?? {})) {
      assert.match(
        priceLabel,
        /元\/张$/,
        `Expected ${modelFamily.id} resolution price label to use 元/张 wording.`,
      );
    }
  }
});

test("OpenAI GPT 2 is the first default model with the updated price", async () => {
  const constantsModule = await import("@/lib/constants").catch(() => null);
  assert.ok(constantsModule, "Expected @/lib/constants to exist.");

  const { DEFAULT_MODEL_FAMILY_ID, MODEL_FAMILY_OPTIONS } = constantsModule;
  const firstModelFamily = MODEL_FAMILY_OPTIONS[0];

  assert.equal(firstModelFamily?.id, "gpt-image-1-5");
  assert.equal(firstModelFamily?.label, "OpenAI GPT 2");
  assert.equal(firstModelFamily?.priceLabel, "0.04 元/张");
  assert.equal(DEFAULT_MODEL_FAMILY_ID, "gpt-image-1-5");
});

test("buildGenerationAttempts keeps Nano Banana Pro on its primary model without fallback", async () => {
  const { buildGenerationAttempts } = await requireImageGenerationModule();

  const attempts = buildGenerationAttempts({
    modelFamilyId: "nano-banana-pro" as never,
    resolutionId: "4k",
    aspectRatioId: "1:1",
  });

  assert.deepEqual(
    attempts.map((attempt) => ({
      familyId: attempt.familyId,
      model: attempt.model,
      requestStrategy: attempt.requestStrategy,
      endpoint: attempt.endpoint,
      responseFormat: attempt.responseFormat,
    })),
    [
      {
        familyId: "nano-banana-pro",
        model: "nano-banana-pro-4k",
        requestStrategy: "edits-model-name",
        endpoint: "/v1/images/edits",
        responseFormat: "url",
      },
    ],
  );
});

test("buildGenerationAttempts maps Doubao and GPT Image sizes from resolution and aspect ratio", async () => {
  const {
    buildGenerationAttempts,
    getModelFamilyDisplayAttempt,
    getResolutionPriceChangeNotice,
    getSupportedAspectRatioIds,
    getSupportedResolutionIds,
  } =
    await requireImageGenerationModule();

  const nanoBananaAttempt = buildGenerationAttempts({
    modelFamilyId: "nano-banana",
    resolutionId: "2k",
    aspectRatioId: "1:1",
  })[0];
  const doubaoAttempt = buildGenerationAttempts({
    modelFamilyId: "doubao-seedream",
    resolutionId: "2k",
    aspectRatioId: "4:5",
  })[0];
  const gptAttempt = buildGenerationAttempts({
    modelFamilyId: "gpt-image-1-5",
    resolutionId: "1k",
    aspectRatioId: "2:3",
  })[0];
  const gptWideAttempt = buildGenerationAttempts({
    modelFamilyId: "gpt-image-1-5",
    resolutionId: "4k",
    aspectRatioId: "16:9",
  })[0];
  const gptTallAttempt = buildGenerationAttempts({
    modelFamilyId: "gpt-image-1-5",
    resolutionId: "2k",
    aspectRatioId: "9:16",
  })[0];

  assert.equal(nanoBananaAttempt.endpoint, "/v1/images/edits");
  assert.equal(nanoBananaAttempt.requestStrategy, "edits-model-name");
  assert.equal(nanoBananaAttempt.model, "nano-banana-hd");
  assert.equal(nanoBananaAttempt.priceLabel, "0.12 元/张");

  assert.equal(doubaoAttempt.endpoint, "/v1/images/generations");
  assert.equal(doubaoAttempt.requestStrategy, "generations-json-size");
  assert.equal(doubaoAttempt.size, "1638x2048");

  assert.equal(gptAttempt.endpoint, "/v1/images/edits");
  assert.equal(gptAttempt.requestStrategy, "edits-size");
  assert.equal(gptAttempt.size, "1024x1536");
  assert.equal(gptAttempt.responseFormat, "b64_json");
  assert.equal(gptWideAttempt.size, "3840x2160");
  assert.equal(gptTallAttempt.size, "1152x2048");

  const nanoBananaDisplayAttempt = getModelFamilyDisplayAttempt({
    modelFamilyId: "nano-banana",
    resolutionId: "2k",
    aspectRatioId: "1:1",
  });

  assert.equal(nanoBananaDisplayAttempt.priceLabel, "0.12 元/张");
  assert.equal(nanoBananaDisplayAttempt.model, "nano-banana-hd");

  assert.equal(
    getResolutionPriceChangeNotice({
      modelFamilyId: "nano-banana",
      currentResolutionId: "1k",
      nextResolutionId: "2k",
      aspectRatioId: "1:1",
    }),
    "Nano Banana 切换到 2K 后按 0.12 元/张 计费。",
  );
  assert.equal(
    getResolutionPriceChangeNotice({
      modelFamilyId: "gemini-flash",
      currentResolutionId: "1k",
      nextResolutionId: "2k",
      aspectRatioId: "1:1",
    }),
    "",
  );

  assert.deepEqual(getSupportedResolutionIds("nano-banana"), ["1k", "2k"]);
  assert.deepEqual(getSupportedResolutionIds("gpt-image-1-5"), ["1k", "2k", "4k"]);
  assert.deepEqual(getSupportedAspectRatioIds("gpt-image-1-5"), [
    "1:1",
    "4:5",
    "3:4",
    "2:3",
    "4:3",
    "3:2",
    "16:9",
    "9:16",
  ]);
});

test("buildGenerationAttempts no longer supports Gemini 2.5 Flash", async () => {
  const { buildGenerationAttempts } = await requireImageGenerationModule();

  assert.throws(
    () =>
      buildGenerationAttempts({
        modelFamilyId: "gemini-2-5-flash-image" as never,
        resolutionId: "1k",
        aspectRatioId: "4:3",
      }),
    /Unknown model family/,
  );
});

test("normalizeGeneratedImageResult keeps external URLs copyable", async () => {
  const { buildGenerationAttempts, normalizeGeneratedImageResult } = await requireImageGenerationModule();

  const [attempt] = buildGenerationAttempts({
    modelFamilyId: "gemini-flash",
    resolutionId: "2k",
    aspectRatioId: "4:3",
  });

  const result = normalizeGeneratedImageResult({
    payload: {
      data: [
        {
          url: "https://cdn.example.com/generated-image.png",
          revised_prompt: "keep the product centered",
        },
      ],
    },
    attempt,
    requestedModelFamilyId: "gemini-flash",
    requestedModel: "gemini-3.1-flash-image-preview-2k",
    aspectRatioId: "4:3",
    resolutionId: "2k",
  });

  assert.equal(result.imageUrl, "https://cdn.example.com/generated-image.png");
  assert.equal(result.copyableImageUrl, "https://cdn.example.com/generated-image.png");
  assert.equal(result.analysisImageUrl, "https://cdn.example.com/generated-image.png");
  assert.equal(result.deliveryKind, "external-url");
  assert.equal(result.actualModelFamilyId, "gemini-flash");
  assert.equal(result.actualModelLabel, "Nano Banana 2");
  assert.equal(result.actualSize, undefined);
  assert.equal(result.usedFallback, false);
  assert.equal(result.revisedPrompt, "keep the product centered");
});

test("normalizeGeneratedImageResult converts b64_json payloads into local-only previews", async () => {
  const { buildGenerationAttempts, normalizeGeneratedImageResult } = await requireImageGenerationModule();

  const [attempt] = buildGenerationAttempts({
    modelFamilyId: "gpt-image-1-5",
    resolutionId: "1k",
    aspectRatioId: "1:1",
  });

  const result = normalizeGeneratedImageResult({
    payload: {
      data: [{ b64_json: "QUJD" }],
      revised_prompt: "make the scene brighter",
    },
    attempt,
    createObjectUrl: () => "blob://generated-preview",
    requestedModelFamilyId: "gpt-image-1-5",
    requestedModel: "gpt-image-2",
    aspectRatioId: "1:1",
    resolutionId: "1k",
  });

  assert.equal(result.imageUrl, "blob://generated-preview");
  assert.equal(result.copyableImageUrl, undefined);
  assert.match(result.analysisImageUrl, /^data:image\/png;base64,QUJD$/);
  assert.equal(result.deliveryKind, "local-data");
  assert.equal(result.actualModelLabel, "OpenAI GPT 2");
  assert.equal(result.actualSize, "1024x1024");
  assert.equal(result.actualPriceLabel, "0.04 元/张");
  assert.equal(result.usedFallback, false);
  assert.equal(result.revisedPrompt, "make the scene brighter");
});

test("normalizeGeneratedImageResult tolerates data URL prefixes and whitespace in b64_json payloads", async () => {
  const { buildGenerationAttempts, normalizeGeneratedImageResult } = await requireImageGenerationModule();

  const [attempt] = buildGenerationAttempts({
    modelFamilyId: "gpt-image-1-5",
    resolutionId: "1k",
    aspectRatioId: "1:1",
  });

  const result = normalizeGeneratedImageResult({
    payload: {
      data: [{ b64_json: "data:image/jpeg;base64,\nQUJD\t" }],
    },
    attempt,
    createObjectUrl: () => "blob://gpt-image-prefixed-preview",
    requestedModelFamilyId: "gpt-image-1-5",
    requestedModel: "gpt-image-2",
    aspectRatioId: "1:1",
    resolutionId: "1k",
  });

  assert.equal(result.imageUrl, "blob://gpt-image-prefixed-preview");
  assert.equal(result.copyableImageUrl, undefined);
  assert.match(result.analysisImageUrl, /^data:image\/jpeg;base64,QUJD$/);
  assert.equal(result.deliveryKind, "local-data");
});

test("coerceGenerationSelection keeps supported GPT Image 2 options unchanged", async () => {
  const { coerceGenerationSelection } = await requireImageGenerationModule();

  const selection = coerceGenerationSelection({
    modelFamilyId: "gpt-image-1-5",
    aspectRatioId: "4:5",
    resolutionId: "4k",
  });

  assert.equal(selection.aspectRatioId, "4:5");
  assert.equal(selection.resolutionId, "4k");
  assert.equal(selection.wasAdjusted, false);
  assert.equal(selection.message, "");
});

test("supportsSellingPointExtraction allows GPT Image 2 local previews and URL-returning models", async () => {
  const { supportsSellingPointExtraction } = await requireImageGenerationModule();

  assert.equal(
    supportsSellingPointExtraction({
      modelFamilyId: "gemini-flash",
      resolutionId: "2k",
      aspectRatioId: "4:3",
    }),
    true,
  );

  assert.equal(
    supportsSellingPointExtraction({
      modelFamilyId: "gpt-image-1-5",
      resolutionId: "1k",
      aspectRatioId: "1:1",
    }),
    true,
  );

  assert.equal(
    supportsSellingPointExtraction({
      modelFamilyId: "gpt-image-1-5",
      resolutionId: "1k",
      aspectRatioId: "2:3",
    }),
    true,
  );
});
