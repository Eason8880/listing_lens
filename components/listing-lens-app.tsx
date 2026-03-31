"use client";

import { startTransition, useEffect, useId, useRef, useState } from "react";

import {
  APP_NAME,
  DEFAULT_MODEL_ID,
  DEFAULT_PRESET_ID,
  LANGUAGE_SUGGESTIONS,
  MODEL_OPTIONS,
  PROMPT_PRESETS,
} from "@/lib/constants";
import type { ExtractedImageCandidate, GenerateImageResponse } from "@/lib/types";

type UploadMode = "file" | "url";

const INPUT_BASE_CLASS =
  "w-full rounded-2xl border border-[rgba(82,55,30,0.12)] bg-white/80 px-4 py-3 text-sm text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition placeholder:text-stone-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-200/60";

export function ListingLensApp() {
  const datalistId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [uploadMode, setUploadMode] = useState<UploadMode>("file");
  const [productUrl, setProductUrl] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("English");
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID);
  const [customPrompt, setCustomPrompt] = useState("");
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState("");
  const [extractedImages, setExtractedImages] = useState<ExtractedImageCandidate[]>([]);
  const [selectedImageUrl, setSelectedImageUrl] = useState("");
  const [result, setResult] = useState<GenerateImageResponse | null>(null);
  const [formError, setFormError] = useState("");
  const [extractError, setExtractError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  const activePreset = PROMPT_PRESETS.find((preset) => preset.id === presetId) ?? PROMPT_PRESETS[1];
  const activeModel = MODEL_OPTIONS.find((item) => item.id === modelId) ?? MODEL_OPTIONS[0];
  const sourcePreview = uploadMode === "file" ? filePreviewUrl : selectedImageUrl;
  const canGenerate =
    targetLanguage.trim().length > 0 &&
    ((uploadMode === "file" && Boolean(selectedFile)) ||
      (uploadMode === "url" && Boolean(selectedImageUrl)));

  async function handleExtractImages() {
    if (!productUrl.trim()) {
      setExtractError("请输入商品详情页 URL。");
      return;
    }

    setIsExtracting(true);
    setExtractError("");
    setFormError("");
    setResult(null);

    try {
      const response = await fetch("/api/extract-images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productUrl: productUrl.trim(),
        }),
      });

      const payload = (await response.json()) as
        | { images: ExtractedImageCandidate[]; error?: string }
        | { error?: string; images?: ExtractedImageCandidate[] };

      if (!response.ok) {
        throw new Error(payload.error ?? "候选图抓取失败，请稍后重试。");
      }

      const nextImages = payload.images ?? [];

      startTransition(() => {
        setExtractedImages(nextImages);
        setSelectedImageUrl(nextImages[0]?.url ?? "");
      });

      if (!nextImages.length) {
        setExtractError("没有识别到可用主图，建议直接上传商品主图。");
      }
    } catch (error) {
      setExtractError(error instanceof Error ? error.message : "候选图抓取失败，请稍后重试。");
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleGenerate() {
    if (!targetLanguage.trim()) {
      setFormError("目标语言不能为空。");
      return;
    }

    if (uploadMode === "file" && !selectedFile) {
      setFormError("请先上传商品主图。");
      return;
    }

    if (uploadMode === "url" && !selectedImageUrl) {
      setFormError("请先从候选图里选择一张主图。");
      return;
    }

    setIsGenerating(true);
    setFormError("");
    setCopied(false);

    try {
      const body = new FormData();

      if (uploadMode === "file" && selectedFile) {
        body.append("image", selectedFile, selectedFile.name);
      }

      if (uploadMode === "url" && selectedImageUrl) {
        body.append("remoteImageUrl", selectedImageUrl);
      }

      body.append("sourceLanguage", sourceLanguage.trim());
      body.append("targetLanguage", targetLanguage.trim());
      body.append("presetId", presetId);
      body.append("customPrompt", customPrompt.trim());
      body.append("model", modelId);

      const response = await fetch("/api/generate-image", {
        method: "POST",
        body,
      });

      const payload = (await response.json()) as
        | GenerateImageResponse
        | { error?: string; imageUrl?: string; revisedPrompt?: string; model?: string };

      if (!response.ok || typeof payload.imageUrl !== "string") {
        throw new Error(("error" in payload && payload.error) || "图片生成失败，请稍后重试。");
      }

      setResult({
        imageUrl: payload.imageUrl,
        revisedPrompt: payload.revisedPrompt,
        model: payload.model ?? activeModel.label,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "图片生成失败，请稍后重试。");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopyResultUrl() {
    if (!result?.imageUrl) {
      return;
    }

    await navigator.clipboard.writeText(result.imageUrl);
    setCopied(true);

    window.setTimeout(() => {
      setCopied(false);
    }, 1800);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];

    if (!nextFile) {
      return;
    }

    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }

    setSelectedFile(nextFile);
    setFilePreviewUrl(URL.createObjectURL(nextFile));
    setResult(null);
    setFormError("");
  }

  return (
    <main className="relative overflow-hidden px-4 py-6 text-stone-900 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-10 h-64 w-64 rounded-full bg-orange-300/30 blur-3xl" />
        <div className="absolute right-[-4rem] top-40 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/3 h-72 w-72 rounded-full bg-yellow-200/30 blur-3xl" />
      </div>

      <div className="relative mx-auto flex max-w-7xl flex-col gap-6">
        <section className="glass-panel-strong rounded-[2rem] px-6 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <span className="inline-flex w-fit items-center rounded-full border border-orange-300/60 bg-orange-100/80 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-orange-700 uppercase">
                Cross-border Ecommerce Imaging
              </span>
              <div className="space-y-2">
                <h1 className="text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl">
                  {APP_NAME}
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-stone-600 sm:text-base">
                  把商品主图的本地化、翻译替字和电商视觉美化收进一个工作台里。
                  上传图片或粘贴商品页链接，几步就能生成更适合目标市场的主图版本。
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="主流程" value="上传 / URL 抓图" />
              <StatCard label="默认模型" value={MODEL_OPTIONS[0].label} />
              <StatCard label="结果交付" value="URL 可复制" />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <div className="glass-panel rounded-[2rem] p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-stone-900">生成配置</p>
                <p className="text-sm text-stone-500">先选主图来源，再配置语言、提示词和模型。</p>
              </div>
              <span className="rounded-full border border-stone-200 bg-white/70 px-3 py-1 text-xs font-medium text-stone-600">
                无登录 MVP
              </span>
            </div>

            <div className="space-y-6">
              <div className="rounded-[1.5rem] border border-stone-200/80 bg-white/70 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setUploadMode("file")}
                    className={`rounded-[1.25rem] px-4 py-3 text-left transition ${
                      uploadMode === "file"
                        ? "bg-stone-900 text-white shadow-lg shadow-stone-900/20"
                        : "bg-white text-stone-700 hover:bg-orange-50"
                    }`}
                  >
                    <p className="text-sm font-semibold">本地上传主图</p>
                    <p className="mt-1 text-xs opacity-80">最稳妥，适合你已经拿到原始主图时使用。</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUploadMode("url")}
                    className={`rounded-[1.25rem] px-4 py-3 text-left transition ${
                      uploadMode === "url"
                        ? "bg-stone-900 text-white shadow-lg shadow-stone-900/20"
                        : "bg-white text-stone-700 hover:bg-orange-50"
                    }`}
                  >
                    <p className="text-sm font-semibold">商品 URL 抓图</p>
                    <p className="mt-1 text-xs opacity-80">适合直接从 Amazon、Shopify、AliExpress 等页面找主图。</p>
                  </button>
                </div>
              </div>

              {uploadMode === "file" ? (
                <section className="rounded-[1.5rem] border border-stone-200/80 bg-white/70 p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-900">上传商品主图</p>
                      <p className="text-xs leading-6 text-stone-500">
                        支持 JPG、PNG、WEBP、AVIF，建议上传 2000px 以上主图。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-full bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700"
                    >
                      选择文件
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  <div className="rounded-[1.25rem] border border-dashed border-orange-300/70 bg-orange-50/60 p-4 text-sm text-stone-600">
                    {selectedFile ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-stone-900">{selectedFile.name}</p>
                          <p className="text-xs text-stone-500">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-full border border-orange-300 bg-white px-3 py-1.5 text-xs font-medium text-orange-700 transition hover:border-orange-400 hover:text-orange-800"
                        >
                          更换图片
                        </button>
                      </div>
                    ) : (
                      <p>拖拽或选择一张商品主图，ListingLens 会保留主体构图并生成目标市场版本。</p>
                    )}
                  </div>
                </section>
              ) : (
                <section className="rounded-[1.5rem] border border-stone-200/80 bg-white/70 p-4">
                  <div className="space-y-3">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-stone-900">商品详情页 URL</label>
                      <input
                        value={productUrl}
                        onChange={(event) => setProductUrl(event.target.value)}
                        placeholder="https://..."
                        className={INPUT_BASE_CLASS}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleExtractImages}
                      disabled={isExtracting}
                      className="inline-flex items-center justify-center rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                    >
                      {isExtracting ? "正在抓取候选图..." : "抓取候选主图"}
                    </button>

                    {extractError ? (
                      <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {extractError}
                      </p>
                    ) : null}

                    {extractedImages.length ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-stone-900">候选主图</p>
                          <p className="text-xs text-stone-500">点击图片即可选中生成</p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          {extractedImages.map((image) => {
                            const isSelected = selectedImageUrl === image.url;

                            return (
                              <button
                                key={image.url}
                                type="button"
                                onClick={() => {
                                  setSelectedImageUrl(image.url);
                                  setResult(null);
                                  setFormError("");
                                }}
                                className={`overflow-hidden rounded-[1.25rem] border text-left transition ${
                                  isSelected
                                    ? "border-orange-500 bg-orange-50 shadow-lg shadow-orange-200/50"
                                    : "border-stone-200 bg-white hover:border-orange-300"
                                }`}
                              >
                                <div className="aspect-[4/3] overflow-hidden bg-stone-100">
                                  <img
                                    src={image.url}
                                    alt="候选商品图"
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                                <div className="space-y-1 px-3 py-3">
                                  <p className="text-sm font-medium text-stone-900">{image.source}</p>
                                  <p className="line-clamp-2 text-xs text-stone-500">{image.url}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </section>
              )}

              <section className="grid gap-4 rounded-[1.5rem] border border-stone-200/80 bg-white/70 p-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-stone-900">源语言（可选）</label>
                  <input
                    list={datalistId}
                    value={sourceLanguage}
                    onChange={(event) => setSourceLanguage(event.target.value)}
                    placeholder="留空则自动识别是否有文字"
                    className={INPUT_BASE_CLASS}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-stone-900">目标语言</label>
                  <input
                    list={datalistId}
                    value={targetLanguage}
                    onChange={(event) => setTargetLanguage(event.target.value)}
                    placeholder="例如 English / Deutsch / 日本語"
                    className={INPUT_BASE_CLASS}
                    required
                  />
                </div>

                <datalist id={datalistId}>
                  {LANGUAGE_SUGGESTIONS.map((language) => (
                    <option key={language} value={language} />
                  ))}
                </datalist>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-stone-900">提示词预设</label>
                  <div className="grid gap-3 lg:grid-cols-3">
                    {PROMPT_PRESETS.map((preset) => {
                      const active = preset.id === presetId;

                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setPresetId(preset.id)}
                          className={`rounded-[1.25rem] border px-4 py-4 text-left transition ${
                            active
                              ? "border-orange-500 bg-orange-50 shadow-lg shadow-orange-100"
                              : "border-stone-200 bg-white hover:border-orange-300"
                          }`}
                        >
                          <p className="text-sm font-semibold text-stone-900">{preset.name}</p>
                          <p className="mt-2 text-xs leading-6 text-stone-500">{preset.summary}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-stone-900">补充说明（可选）</label>
                  <textarea
                    value={customPrompt}
                    onChange={(event) => setCustomPrompt(event.target.value)}
                    rows={4}
                    placeholder="例如：保留包装盒位置，突出防水卖点，整体风格更偏 Amazon 北美市场。"
                    className={`${INPUT_BASE_CLASS} min-h-28 resize-y`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-stone-900">模型选择</label>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {MODEL_OPTIONS.map((model) => {
                      const active = model.id === modelId;

                      return (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => setModelId(model.id)}
                          className={`rounded-[1.5rem] border px-4 py-4 text-left transition ${
                            active
                              ? "border-stone-900 bg-stone-900 text-white shadow-xl shadow-stone-900/10"
                              : "border-stone-200 bg-white hover:border-stone-300"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">{model.label}</p>
                              <p
                                className={`mt-2 text-xs leading-6 ${
                                  active ? "text-stone-200" : "text-stone-500"
                                }`}
                              >
                                {model.description}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${
                                active
                                  ? "bg-white/15 text-white"
                                  : "bg-orange-100 text-orange-700"
                              }`}
                            >
                              {model.priceLabel}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="sm:col-span-2 rounded-[1.25rem] border border-amber-200 bg-amber-50/80 px-4 py-4 text-sm leading-7 text-amber-900">
                  <p className="font-semibold">当前生成策略</p>
                  <p className="mt-1">
                    {activePreset.name}。系统会优先保留商品主体、构图和真实信息；
                    {sourceLanguage.trim()
                      ? `会把图中文字从 ${sourceLanguage.trim()} 转成 ${targetLanguage.trim()}。`
                      : "若检测到图中已有文字，会自动翻译成目标语言；若没有文字，则只做主图美化。"}
                  </p>
                </div>
              </section>

              {formError ? (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </p>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerate || isGenerating}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-orange-600 px-6 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-orange-300"
                >
                  {isGenerating ? "正在生成主图..." : "生成优化图片"}
                </button>

                <p className="text-sm text-stone-500">
                  选择模型：<span className="font-medium text-stone-900">{activeModel.label}</span>，
                  单次成本 {activeModel.priceLabel}
                </p>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-[2rem] p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-stone-900">预览与结果</p>
                <p className="text-sm text-stone-500">左看输入图，右看生成图，结果 URL 支持一键复制。</p>
              </div>
              {result?.model ? (
                <span className="rounded-full border border-stone-200 bg-white/80 px-3 py-1 text-xs font-medium text-stone-600">
                  {result.model}
                </span>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <PreviewCard
                title="原始主图"
                subtitle={uploadMode === "file" ? "本地上传" : "URL 候选图"}
                imageUrl={sourcePreview}
                emptyState="上传主图，或先从商品 URL 中抓取并选择候选图。"
              />

              <PreviewCard
                title="生成结果"
                subtitle={result ? "AI 输出" : "等待生成"}
                imageUrl={result?.imageUrl ?? ""}
                emptyState="完成配置后点击“生成优化图片”，这里会展示最终结果。"
              />
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-stone-200/80 bg-white/70 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-stone-900">生成图 URL</p>
                  <p className="text-xs leading-6 text-stone-500">
                    支持直接复制，可用于回填到运营流程或人工复核。
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCopyResultUrl}
                  disabled={!result?.imageUrl}
                  className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 transition hover:border-stone-400 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {copied ? "已复制" : "复制 URL"}
                </button>
              </div>

              <div className="mt-3 rounded-[1.25rem] bg-stone-950 px-4 py-3 text-xs leading-6 text-stone-200">
                {result?.imageUrl || "生成完成后，这里会展示服务商返回的图片 URL。"}
              </div>

              {result?.revisedPrompt ? (
                <div className="mt-4 rounded-[1.25rem] border border-stone-200 bg-stone-50 px-4 py-4">
                  <p className="text-sm font-semibold text-stone-900">服务端返回的修订提示词</p>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-stone-600">
                    {result.revisedPrompt}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-white/60 bg-white/70 px-4 py-4 shadow-[0_16px_45px_rgba(69,38,15,0.08)]">
      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-stone-900">{value}</p>
    </div>
  );
}

function PreviewCard({
  title,
  subtitle,
  imageUrl,
  emptyState,
}: {
  title: string;
  subtitle: string;
  imageUrl: string;
  emptyState: string;
}) {
  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-stone-200 bg-white">
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-stone-900">{title}</p>
          <p className="text-xs text-stone-500">{subtitle}</p>
        </div>
      </div>

      <div className="aspect-[4/3] bg-[linear-gradient(135deg,rgba(246,240,232,0.95),rgba(238,226,211,0.9))]">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm leading-7 text-stone-500">
            {emptyState}
          </div>
        )}
      </div>
    </article>
  );
}
