"use client";

import { startTransition, useEffect, useRef, useState } from "react";

import {
  APP_NAME,
  API_BASE_URL,
  API_KEY_STORAGE_KEY,
  ALLOWED_IMAGE_TYPES,
  ASPECT_RATIO_OPTIONS,
  DEFAULT_MODEL_ID,
  DEFAULT_PRESET_ID,
  DEFAULT_ASPECT_RATIO_ID,
  LANGUAGE_OPTIONS,
  MAX_REMOTE_IMAGE_BYTES,
  MAX_UPLOAD_BYTES,
  MODEL_OPTIONS,
  PROMPT_PRESETS,
} from "@/lib/constants";
import { buildGenerationPrompt } from "@/lib/prompt";
import type {
  AspectRatioId,
  ExtractedImageCandidate,
  GenerateImageResponse,
  ModelOptionId,
  PromptPresetId,
} from "@/lib/types";

type UploadMode = "file" | "url";
type ImagesEditApiResponse = {
  data?: Array<{
    url?: string;
    revised_prompt?: string;
  }>;
  revised_prompt?: string;
  message?: string;
  error?: {
    message?: string;
  };
};

const INPUT_BASE_CLASS =
  "w-full rounded-2xl border border-[rgba(82,55,30,0.12)] bg-white/80 px-4 py-3 text-sm text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition placeholder:text-stone-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-200/60";
const PANEL_HEADER_CLASS =
  "flex items-center justify-between gap-4 border-b border-[rgba(67,47,28,0.08)] bg-[#fbf5ec] px-4 py-3";
const PANEL_SCROLL_AREA_CLASS =
  "scrollbar-soft scrollbar-soft-desktop min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4 sm:px-5 sm:pb-5";
const STEP_BADGE_CLASS =
  "shrink-0 whitespace-nowrap rounded-full border border-stone-200 bg-white/80 px-3 py-1 text-xs font-medium text-stone-600";

export function ListingLensApp() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [uploadMode, setUploadMode] = useState<UploadMode>("file");
  const [productUrl, setProductUrl] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("English");
  const [apiKey, setApiKey] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioId>(DEFAULT_ASPECT_RATIO_ID);
  const [presetId, setPresetId] = useState<PromptPresetId>(DEFAULT_PRESET_ID);
  const [customPrompt, setCustomPrompt] = useState("");
  const [modelId, setModelId] = useState<ModelOptionId>(DEFAULT_MODEL_ID);
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
    const storedApiKey = window.localStorage.getItem(API_KEY_STORAGE_KEY);

    if (storedApiKey) {
      setApiKey(storedApiKey);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  useEffect(() => {
    if (!apiKey) {
      window.localStorage.removeItem(API_KEY_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
  }, [apiKey]);

  useEffect(() => {
    if (!isSettingsOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsSettingsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSettingsOpen]);

  const activePreset = PROMPT_PRESETS.find((preset) => preset.id === presetId) ?? PROMPT_PRESETS[1];
  const activeModel = MODEL_OPTIONS.find((item) => item.id === modelId) ?? MODEL_OPTIONS[0];
  const activeAspectRatio =
    ASPECT_RATIO_OPTIONS.find((item) => item.id === aspectRatio) ?? ASPECT_RATIO_OPTIONS[0];
  const sourcePreview = uploadMode === "file" ? filePreviewUrl : selectedImageUrl;
  const canGenerate =
    apiKey.trim().length > 0 &&
    targetLanguage.trim().length > 0 &&
    ((uploadMode === "file" && Boolean(selectedFile)) ||
      (uploadMode === "url" && Boolean(selectedImageUrl)));

  async function resolveSourceFile() {
    if (uploadMode === "file" && selectedFile) {
      if (!ALLOWED_IMAGE_TYPES.has(selectedFile.type)) {
        throw new Error("图片格式不受支持，仅支持 JPG、PNG、WEBP、AVIF。");
      }

      if (selectedFile.size > MAX_UPLOAD_BYTES) {
        throw new Error("上传图片体积过大，请控制在 10MB 以内。");
      }

      return selectedFile;
    }

    if (!selectedImageUrl) {
      throw new Error("请先从候选图里选择一张主图。");
    }

    let response: Response;

    try {
      response = await fetch(selectedImageUrl, {
        headers: {
          accept: "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8",
        },
      });
    } catch {
      throw new Error("候选图所在站点阻止了浏览器直接读取图片，请先下载后再手动上传。");
    }

    if (!response.ok) {
      throw new Error(`候选图下载失败，目标站点返回 ${response.status}。`);
    }

    const imageBlob = await response.blob();

    if (!ALLOWED_IMAGE_TYPES.has(imageBlob.type)) {
      throw new Error("候选图格式不受支持，请下载后转成 JPG、PNG、WEBP 或 AVIF 再上传。");
    }

    if (imageBlob.size > MAX_REMOTE_IMAGE_BYTES) {
      throw new Error("候选图体积过大，请压缩后上传，或换一张分辨率更合适的主图。");
    }

    const pathname = new URL(selectedImageUrl).pathname.split("/").pop() || "remote-image";
    const extension = imageBlob.type.split("/")[1] ?? "png";
    const filename = pathname.includes(".") ? pathname : `${pathname}.${extension}`;

    return new File([imageBlob], filename, { type: imageBlob.type });
  }

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
    if (!apiKey.trim()) {
      setFormError("请先点击右上角齿轮设置 API Key，密钥只会保存在当前浏览器本地。");
      return;
    }

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
      const sourceFile = await resolveSourceFile();
      const prompt = buildGenerationPrompt({
        sourceLanguage: sourceLanguage.trim() || undefined,
        targetLanguage: targetLanguage.trim(),
        aspectRatio,
        presetId,
        customPrompt: customPrompt.trim() || undefined,
      });

      const body = new FormData();
      body.append("model", activeModel.label);
      body.append("prompt", prompt);
      body.append("n", "1");
      body.append("response_format", "url");
      body.append("image", sourceFile, sourceFile.name);

      const response = await fetch(`${API_BASE_URL}/v1/images/edits`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          Accept: "application/json",
        },
        body,
      });

      const payload = (await response.json()) as ImagesEditApiResponse;

      const resultPayload = Array.isArray(payload.data) ? payload.data[0] : undefined;

      if (!response.ok || typeof resultPayload?.url !== "string") {
        const errorMessage =
          (typeof payload.error?.message === "string" && payload.error.message) ||
          (typeof payload.message === "string" && payload.message) ||
          "图片生成失败，请稍后重试。";

        throw new Error(errorMessage);
      }

      setResult({
        imageUrl: resultPayload.url,
        revisedPrompt:
          (typeof resultPayload.revised_prompt === "string" && resultPayload.revised_prompt) ||
          ("revised_prompt" in payload && typeof payload.revised_prompt === "string"
            ? payload.revised_prompt
            : undefined),
        model: activeModel.label,
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
    <main className="relative min-h-screen overflow-hidden px-4 py-4 text-stone-900 sm:px-5 lg:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-6 h-56 w-56 rounded-full bg-orange-300/25 blur-3xl" />
        <div className="absolute right-[-4rem] top-32 h-64 w-64 rounded-full bg-amber-200/35 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/3 h-64 w-64 rounded-full bg-yellow-200/25 blur-3xl" />
      </div>

      <div className="relative mx-auto flex max-w-[1760px] flex-col gap-4">
        <section className="glass-panel-strong rounded-[1.75rem] px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 max-w-4xl space-y-2">
              <span className="inline-flex w-fit items-center rounded-full border border-orange-300/60 bg-orange-100/80 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-orange-700 uppercase">
                Cross-border Ecommerce Imaging
              </span>
              <div className="space-y-1.5">
                <h1 className="text-3xl font-semibold tracking-tight text-stone-950 sm:text-[2rem]">
                  {APP_NAME}
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-stone-600">
                  把商品主图的本地化、翻译替字和电商视觉美化收进一个工作台里。
                  上传图片或粘贴商品页链接，几步就能生成更适合目标市场的主图版本。
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:items-end">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-orange-200 bg-orange-50/90 px-4 py-2 text-sm font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100"
                aria-label="输入或获取 API Key"
                title="输入或获取 API Key"
              >
                <GearIcon />
                <span>{apiKey.trim() ? "已保存 API Key" : "输入或获取 API Key"}</span>
              </button>

              <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[620px]">
                <StatCard label="主流程" value="上传 / URL 抓图" />
                <StatCard label="默认比例" value={activeAspectRatio.id} />
                <StatCard label="结果交付" value="URL 可复制" />
              </div>
            </div>
          </div>
        </section>

        <div className="overflow-x-auto pb-1">
          <section className="grid min-w-[1360px] gap-4 h-[calc(100vh-12rem)] grid-cols-[minmax(320px,0.72fr)_minmax(460px,1fr)_minmax(380px,0.82fr)]">
          <div className="glass-panel flex min-h-0 overflow-hidden rounded-[1.75rem] flex-col">
            <div className={PANEL_HEADER_CLASS}>
              <div>
                <p className="text-sm font-semibold text-stone-900">生成配置</p>
                <p className="text-sm text-stone-500">先选主图来源，再准备输入素材。</p>
              </div>
              <span className={STEP_BADGE_CLASS}>
                Step 1
              </span>
            </div>

            <div className={PANEL_SCROLL_AREA_CLASS}>
              <div className="space-y-4">
              <div className="rounded-[1.35rem] border border-stone-200/80 bg-white/70 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setUploadMode("file")}
                    className={`flex min-h-[10.5rem] flex-col justify-start rounded-[1.25rem] px-4 py-3 text-left transition ${
                      uploadMode === "file"
                        ? "bg-stone-900 text-white shadow-lg shadow-stone-900/20"
                        : "bg-white text-stone-700 hover:bg-orange-50"
                    }`}
                  >
                    <p className="text-sm font-semibold">本地上传主图</p>
                    <p className="mt-1 text-[12px] leading-6 opacity-80">最稳妥，适合已拿到原图时使用。</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUploadMode("url")}
                    className={`flex min-h-[10.5rem] flex-col justify-start rounded-[1.25rem] px-4 py-3 text-left transition ${
                      uploadMode === "url"
                        ? "bg-stone-900 text-white shadow-lg shadow-stone-900/20"
                        : "bg-white text-stone-700 hover:bg-orange-50"
                    }`}
                  >
                    <p className="text-sm font-semibold">商品 URL 抓图</p>
                    <p className="mt-1 text-[12px] leading-6 opacity-80">适合直接从电商页面提取主图。</p>
                  </button>
                </div>
              </div>

              {uploadMode === "file" ? (
                <section className="rounded-[1.35rem] border border-stone-200/80 bg-white/70 p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-900">上传商品主图</p>
                      <p className="text-[12px] leading-5 text-stone-500">
                        支持 JPG、PNG、WEBP、AVIF，建议 2000px 以上。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="min-w-[7.5rem] whitespace-nowrap rounded-full bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700"
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
                <section className="rounded-[1.35rem] border border-stone-200/80 bg-white/70 p-4">
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
              </div>
            </div>
          </div>

          <div className="glass-panel flex min-h-0 overflow-hidden rounded-[1.75rem] flex-col">
            <div className={PANEL_HEADER_CLASS}>
              <div>
                <p className="text-sm font-semibold text-stone-900">生成参数</p>
                <p className="text-sm text-stone-500">配置语言、比例、模型和补充说明。</p>
              </div>
              <span className={STEP_BADGE_CLASS}>
                Step 2
              </span>
            </div>

            <div className={PANEL_SCROLL_AREA_CLASS}>
              <div className="space-y-4">
              <section className="grid gap-4 rounded-[1.35rem] border border-stone-200/80 bg-white/70 p-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-stone-900">源语言（可选）</label>
                  <select
                    value={sourceLanguage}
                    onChange={(event) => setSourceLanguage(event.target.value)}
                    className={INPUT_BASE_CLASS}
                  >
                    <option value="">自动识别（未指定）</option>
                    {LANGUAGE_OPTIONS.map((language) => (
                      <option key={language.value} value={language.value}>
                        {language.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-stone-900">目标语言</label>
                  <select
                    value={targetLanguage}
                    onChange={(event) => setTargetLanguage(event.target.value)}
                    className={INPUT_BASE_CLASS}
                    required
                  >
                    {LANGUAGE_OPTIONS.map((language) => (
                      <option key={language.value} value={language.value}>
                        {language.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-stone-900">输出画面比例</label>
                  <div className="grid gap-2 md:grid-cols-3">
                    {ASPECT_RATIO_OPTIONS.map((option) => {
                      const active = option.id === aspectRatio;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setAspectRatio(option.id)}
                          className={`flex min-h-[5.5rem] flex-col justify-start rounded-[1.1rem] border px-3 py-2 text-left transition ${
                            active
                              ? "border-orange-500 bg-orange-50 shadow-lg shadow-orange-100"
                              : "border-stone-200 bg-white hover:border-orange-300"
                          }`}
                        >
                          <p className="text-sm font-semibold text-stone-900">{option.label}</p>
                          <p className="mt-1 text-[12px] leading-[1.35rem] text-stone-500">{option.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-stone-900">提示词预设</label>
                  <div className="grid gap-2 lg:grid-cols-3">
                    {PROMPT_PRESETS.map((preset) => {
                      const active = preset.id === presetId;

                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setPresetId(preset.id)}
                          className={`rounded-[1.1rem] border px-3 py-2.5 text-left transition ${
                            active
                              ? "border-orange-500 bg-orange-50 shadow-lg shadow-orange-100"
                              : "border-stone-200 bg-white hover:border-orange-300"
                          }`}
                        >
                          <p className="text-sm font-semibold text-stone-900">{preset.name}</p>
                          <p className="mt-1.5 text-[12px] leading-5 text-stone-500">{preset.summary}</p>
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
                    rows={3}
                    placeholder="例如：保留包装盒位置，突出防水卖点，整体风格更偏 Amazon 北美市场。"
                    className={`${INPUT_BASE_CLASS} min-h-24 resize-y`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-stone-900">模型选择</label>
                  <div className="grid gap-2 lg:grid-cols-2">
                    {MODEL_OPTIONS.map((model) => {
                      const active = model.id === modelId;

                      return (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => setModelId(model.id)}
                          className={`rounded-[1.2rem] border px-4 py-3 text-left transition ${
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

                <div className="sm:col-span-2 rounded-[1.15rem] border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-900">
                  <p className="font-semibold">当前生成策略</p>
                  <p className="mt-1">
                    {activePreset.name}。系统会优先保留商品主体、构图和真实信息；
                    {sourceLanguage.trim()
                      ? `会把图中文字从 ${sourceLanguage.trim()} 转成 ${targetLanguage.trim()}。`
                      : "若检测到图中已有文字，会自动翻译成目标语言；若没有文字，则只做主图美化。"}
                  </p>
                  <p className="mt-2">输出画面会尽量按 {activeAspectRatio.label} 生成。</p>
                  <p className="mt-2 text-xs leading-6 text-amber-800">
                    如果商品站点禁止浏览器直接读取候选图，URL 抓图后可能无法直接生成，此时请把主图下载后改用本地上传。
                  </p>
                </div>
              </section>

              {formError ? (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </p>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerate || isGenerating}
                  className="inline-flex min-h-12 whitespace-nowrap items-center justify-center rounded-full bg-orange-600 px-6 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-orange-300"
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
          </div>

          <div className="glass-panel flex min-h-0 overflow-hidden rounded-[1.75rem] flex-col">
            <div className={PANEL_HEADER_CLASS}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-stone-900">预览与结果</p>
                <p className="truncate text-sm text-stone-500">左看输入图，右看生成图，结果 URL 支持一键复制。</p>
              </div>
              <span className={STEP_BADGE_CLASS}>
                Step 3
              </span>
            </div>

            <div className={PANEL_SCROLL_AREA_CLASS}>
              {result?.model ? (
                <div className="mb-4 inline-flex rounded-full border border-stone-200 bg-white/80 px-3 py-1 text-xs font-medium text-stone-600">
                  {result.model}
                </div>
              ) : null}

              <div className="space-y-4">
                <div className="grid gap-4 2xl:grid-cols-2">
                <PreviewCard
                  title="原始主图"
                  subtitle={uploadMode === "file" ? "本地上传" : "URL 候选图"}
                  imageUrl={sourcePreview}
                  aspectRatio={activeAspectRatio.aspectRatio}
                  emptyState="上传主图，或先从商品 URL 中抓取并选择候选图。"
                />

                <PreviewCard
                  title="生成结果"
                  subtitle={result ? "AI 输出" : "等待生成"}
                  imageUrl={result?.imageUrl ?? ""}
                  aspectRatio={activeAspectRatio.aspectRatio}
                  emptyState="完成配置后点击“生成优化图片”，这里会展示最终结果。"
                />
                </div>

                <div className="rounded-[1.35rem] border border-stone-200/80 bg-white/70 p-4">
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

                  <div className="mt-3 rounded-[1.1rem] bg-stone-950 px-4 py-3 text-xs leading-6 text-stone-200">
                    {result?.imageUrl || "生成完成后，这里会展示服务商返回的图片 URL。"}
                  </div>

                  {result?.revisedPrompt ? (
                    <div className="mt-4 rounded-[1.1rem] border border-stone-200 bg-stone-50 px-4 py-4">
                      <p className="text-sm font-semibold text-stone-900">服务端返回的修订提示词</p>
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-stone-600">
                        {result.revisedPrompt}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          </section>
        </div>
      </div>

      {isSettingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 px-4 py-6">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="关闭 API Key 设置"
            onClick={() => setIsSettingsOpen(false)}
          />
          <section className="relative z-10 w-full max-w-lg rounded-[2rem] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,252,248,0.98),rgba(249,244,236,0.98))] p-6 shadow-[0_32px_100px_rgba(32,18,5,0.28)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-orange-700">API Key 设置</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                  管理本地预览所用的 API Key
                </h2>
                <p className="mt-2 text-sm leading-7 text-stone-600">
                  密钥只保存在当前浏览器本地，不写入服务器环境变量。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white/85 text-stone-500 transition hover:text-stone-900"
                aria-label="关闭设置"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-sm font-semibold text-stone-900">API Key</label>
                  <button
                    type="button"
                    onClick={() => setApiKey("")}
                    className="text-xs font-medium text-stone-500 transition hover:text-stone-900"
                  >
                    清除本地保存
                  </button>
                </div>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="输入你的 API Key，仅保存在当前浏览器本地"
                  autoComplete="off"
                  className={INPUT_BASE_CLASS}
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href="https://api.bltcy.ai/register?aff=kGaB90952"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-orange-600 px-5 text-sm font-semibold text-white no-underline shadow-lg shadow-orange-600/25 transition hover:bg-orange-700"
                >
                  获取 API Key
                </a>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-stone-300 bg-white px-5 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-stone-50"
                >
                  完成
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
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
  aspectRatio,
  emptyState,
}: {
  title: string;
  subtitle: string;
  imageUrl: string;
  aspectRatio: string;
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

      <div
        className="bg-[linear-gradient(135deg,rgba(246,240,232,0.95),rgba(238,226,211,0.9))]"
        style={{ aspectRatio }}
      >
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

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317a1.724 1.724 0 0 1 3.35 0l.19.76a1.724 1.724 0 0 0 2.573 1.066l.68-.399a1.724 1.724 0 0 1 2.37.63l.548.95a1.724 1.724 0 0 1-.63 2.37l-.68.399a1.724 1.724 0 0 0-.842 1.49c0 .533.208 1.044.58 1.427l.544.56a1.724 1.724 0 0 1 0 2.396l-.77.793a1.724 1.724 0 0 1-2.396 0l-.544-.56a1.724 1.724 0 0 0-1.427-.58 1.724 1.724 0 0 0-1.49.842l-.399.68a1.724 1.724 0 0 1-2.37.63l-.95-.548a1.724 1.724 0 0 1-.63-2.37l.399-.68a1.724 1.724 0 0 0-1.066-2.573l-.76-.19a1.724 1.724 0 0 1 0-3.35l.76-.19a1.724 1.724 0 0 0 1.066-2.573l-.399-.68a1.724 1.724 0 0 1 .63-2.37l.95-.548a1.724 1.724 0 0 1 2.37.63l.399.68a1.724 1.724 0 0 0 2.573 1.066l.76-.19Z"
      />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}
