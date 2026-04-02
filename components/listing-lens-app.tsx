"use client";

import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

import {
  APP_NAME,
  API_BASE_URL,
  API_KEY_STORAGE_KEY,
  ALLOWED_IMAGE_TYPES,
  ASPECT_RATIO_OPTIONS,
  DEFAULT_ASPECT_RATIO_ID,
  DEFAULT_MODEL_FAMILY_ID,
  DEFAULT_PRESET_ID,
  DEFAULT_RESOLUTION_ID,
  LANGUAGE_OPTIONS,
  MAX_REMOTE_IMAGE_BYTES,
  MAX_UPLOAD_BYTES,
  MODEL_FAMILY_OPTIONS,
  PROMPT_PRESETS,
  RESOLUTION_OPTIONS,
} from "@/lib/constants";
import { buildGenerationPrompt } from "@/lib/prompt";
import type {
  AspectRatioId,
  ExtractedImageCandidate,
  GenerateImageResponse,
  ModelFamilyId,
  PromptPresetId,
  ResolutionId,
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
  "w-full rounded-2xl border border-slate-200/80 bg-[var(--panel-soft)] px-4 py-3 text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] outline-none transition placeholder:text-slate-400 focus:border-[color:var(--accent)] focus:bg-white focus:ring-4 focus:ring-[color:var(--accent-ring)]";
const FIELD_LABEL_CLASS =
  "mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500";
const PANEL_HEADER_CLASS = "dashboard-panel-header flex items-start justify-between gap-4 px-4 py-4";
const PANEL_SCROLL_AREA_CLASS =
  "scrollbar-soft scrollbar-soft-desktop min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4 sm:px-5 sm:pb-5";
const STEP_BADGE_CLASS = "dashboard-step-badge";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function buildProxyImageUrl(imageUrl: string) {
  return imageUrl ? `/api/image-proxy?url=${encodeURIComponent(imageUrl)}` : "";
}

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
  const [modelFamilyId, setModelFamilyId] = useState<ModelFamilyId>(DEFAULT_MODEL_FAMILY_ID);
  const [resolutionId, setResolutionId] = useState<ResolutionId>(DEFAULT_RESOLUTION_ID);
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
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);

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
    if (!isSettingsOpen && !isComparisonOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsSettingsOpen(false);
        setIsComparisonOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSettingsOpen, isComparisonOpen]);

  const activePreset = PROMPT_PRESETS.find((preset) => preset.id === presetId) ?? PROMPT_PRESETS[1];
  const activeModelFamily =
    MODEL_FAMILY_OPTIONS.find((item) => item.id === modelFamilyId) ?? MODEL_FAMILY_OPTIONS[0];
  const activeResolution =
    RESOLUTION_OPTIONS.find((item) => item.id === resolutionId) ?? RESOLUTION_OPTIONS[1];
  const activeModelName = activeModelFamily.models[resolutionId];
  const activeAspectRatio =
    ASPECT_RATIO_OPTIONS.find((item) => item.id === aspectRatio) ?? ASPECT_RATIO_OPTIONS[0];
  const sourcePreview =
    uploadMode === "file" ? filePreviewUrl : buildProxyImageUrl(selectedImageUrl);
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
      response = await fetch(buildProxyImageUrl(selectedImageUrl), {
        headers: {
          accept: "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8",
        },
      });
    } catch {
      throw new Error("候选图代理下载失败，请稍后重试，或先下载后改用本地上传。");
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
      body.append("model", activeModelName);
      body.append("prompt", prompt);
      body.append("n", "1");
      body.append("response_format", "url");
      body.append("aspect_ratio", aspectRatio);
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
        model: activeModelName,
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

  async function handleDownloadResultImage() {
    if (!result?.imageUrl) {
      return;
    }

    try {
      const response = await fetch(result.imageUrl);

      if (!response.ok) {
        throw new Error(`下载失败，服务端返回 ${response.status}。`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const extension = blob.type.split("/")[1] || "png";

      link.href = objectUrl;
      link.download = `listinglens-result-${aspectRatio.replace(":", "x")}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setFormError("当前图片源不支持直接下载，请先复制 URL 后在新标签页打开下载。");
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
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
    <main className="relative min-h-screen overflow-hidden px-4 py-4 text-slate-950 sm:px-5 lg:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-7rem] top-4 h-56 w-56 rounded-full bg-orange-200/45 blur-3xl" />
        <div className="absolute right-[-4rem] top-20 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute bottom-[-7rem] left-1/3 h-64 w-64 rounded-full bg-amber-200/35 blur-3xl" />
      </div>

      <div className="relative mx-auto flex max-w-[1780px] flex-col gap-4">
        <section className="dashboard-hero-panel rounded-[2rem] px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex w-fit items-center rounded-full border border-orange-200 bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--accent)]">
                  Cross-border Imaging Studio
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-xs font-medium text-slate-500 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
                  <span className="h-2 w-2 rounded-full bg-cyan-500" />
                  Ready for market localization
                </span>
              </div>

              <div className="mt-4 space-y-2">
                <h1 className="dashboard-brand text-4xl font-extrabold tracking-tight text-slate-950 sm:text-[3.2rem] sm:leading-[1.02]">
                  {APP_NAME}
                </h1>
                <p className="max-w-3xl text-[15px] leading-7 text-slate-600">
                  把商品主图的文字本地化、画幅适配和电商视觉美化收进一个工作台。粘贴商品页链接或上传图片，
                  配置目标语言与输出比例，几步生成适合目标市场的主图，结果支持一键复制 URL 或下载图片。
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 xl:min-w-[620px] xl:items-end">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="dashboard-secondary-button inline-flex min-h-11 items-center gap-2 px-4 py-2 text-sm font-semibold text-[color:var(--accent)]"
                aria-label="输入或获取 API Key"
                title="输入或获取 API Key"
              >
                <GearIcon />
                <span>{apiKey.trim() ? "已保存 API Key" : "输入或获取 API Key"}</span>
              </button>

              <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[620px]">
                <StatCard label="主流程" value="上传 / URL 抓图" />
                <StatCard label="目标输出" value={`${activeAspectRatio.id} · ${activeResolution.label}`} />
                <StatCard label="结果交付" value="复制 URL / 下载" />
              </div>
            </div>
          </div>
        </section>

        <div className="overflow-x-auto pb-1">
          <section className="grid h-[calc(100vh-13rem)] min-w-[1440px] gap-4 grid-cols-[minmax(320px,0.72fr)_minmax(470px,1fr)_minmax(540px,1.12fr)]">
            <section className="dashboard-panel flex min-h-0 flex-col overflow-hidden rounded-[2rem]">
              <PanelHeader
                icon={<SourceIcon />}
                label="Media Source"
                title="图片来源"
                subtitle="选择主图来源，再准备输入素材。"
                step="Step 1"
              />

              <div className={PANEL_SCROLL_AREA_CLASS}>
                <div className="space-y-4">
                  <div className="dashboard-subpanel rounded-[1.6rem] p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ModeCard
                        title="本地上传"
                        description="适合已经拿到原始主图时快速进入生成。"
                        active={uploadMode === "file"}
                        icon={<UploadModeIcon />}
                        onClick={() => setUploadMode("file")}
                      />
                      <ModeCard
                        title="商品 URL"
                        description="适合从商品详情页直接提取候选主图。"
                        active={uploadMode === "url"}
                        icon={<LinkModeIcon />}
                        onClick={() => setUploadMode("url")}
                      />
                    </div>
                  </div>

                  {uploadMode === "file" ? (
                    <section className="dashboard-subpanel rounded-[1.6rem] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={FIELD_LABEL_CLASS}>Local Upload</p>
                          <h3 className="font-heading text-lg font-bold text-slate-950">上传商品主图</h3>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            支持 JPG、PNG、WEBP、AVIF，建议使用 2000px 以上原图。
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="dashboard-primary-button min-w-[7.5rem] whitespace-nowrap px-4 py-2 text-sm font-semibold"
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

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-4 flex w-full flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-orange-200 bg-[linear-gradient(180deg,rgba(255,245,239,0.95),rgba(255,251,248,0.98))] px-5 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition hover:border-orange-300 hover:bg-[linear-gradient(180deg,rgba(255,241,232,0.98),rgba(255,252,248,1))]"
                      >
                        {selectedFile ? (
                          <div className="flex w-full flex-wrap items-center justify-between gap-4 text-left">
                            <div className="flex items-center gap-3">
                              <span className="dashboard-icon-chip h-11 w-11 rounded-[1rem] bg-orange-100 text-[color:var(--accent)]">
                                <ImageStackIcon />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-950">
                                  {selectedFile.name}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <span className="rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-semibold text-[color:var(--accent)]">
                              点击更换
                            </span>
                          </div>
                        ) : (
                          <>
                            <span className="dashboard-icon-chip h-12 w-12 rounded-[1rem] bg-white text-[color:var(--accent)]">
                              <UploadModeIcon />
                            </span>
                            <p className="mt-4 text-sm font-semibold text-slate-900">
                              Drop your base image here or click to browse
                            </p>
                            <p className="mt-2 max-w-xs text-xs leading-6 text-slate-500">
                              ListingLens 会保留商品主体与卖点层级，再生成适合目标市场的主图版本。
                            </p>
                          </>
                        )}
                      </button>
                    </section>
                  ) : (
                    <section className="dashboard-subpanel rounded-[1.6rem] p-4">
                      <div>
                        <p className={FIELD_LABEL_CLASS}>Product URL</p>
                        <h3 className="font-heading text-lg font-bold text-slate-950">抓取候选主图</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          输入商品详情页链接，服务端会提取主图候选供你选择。
                        </p>
                      </div>

                      <div className="mt-4 space-y-3">
                        <input
                          value={productUrl}
                          onChange={(event) => setProductUrl(event.target.value)}
                          placeholder="https://..."
                          className={INPUT_BASE_CLASS}
                        />

                        <button
                          type="button"
                          onClick={handleExtractImages}
                          disabled={isExtracting}
                          className="dashboard-dark-button inline-flex min-h-11 items-center justify-center px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {isExtracting ? "正在抓取候选图..." : "抓取候选主图"}
                        </button>

                        {extractError ? (
                          <p className="rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {extractError}
                          </p>
                        ) : null}

                        {extractedImages.length ? (
                          <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className={FIELD_LABEL_CLASS}>Candidate Images</p>
                                <p className="font-heading text-lg font-bold text-slate-950">候选主图</p>
                              </div>
                              <p className="text-xs text-slate-500">点击卡片即可选中</p>
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
                                    className={cx(
                                      "dashboard-subpanel overflow-hidden rounded-[1.35rem] border text-left transition",
                                      isSelected
                                        ? "border-[color:var(--border-strong)] ring-2 ring-[color:var(--accent-ring)]"
                                        : "hover:border-[color:var(--border-strong)]",
                                    )}
                                  >
                                    <div className="dashboard-preview-surface aspect-[4/3] overflow-hidden">
                                      <img
                                        src={buildProxyImageUrl(image.url)}
                                        alt="候选商品图"
                                        className="h-full w-full object-cover"
                                      />
                                    </div>
                                    <div className="space-y-1 px-3 py-3">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="truncate text-sm font-semibold text-slate-950">
                                          {image.source}
                                        </p>
                                        {isSelected ? (
                                          <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                                            Selected
                                          </span>
                                        ) : null}
                                      </div>
                                      <p className="line-clamp-2 text-xs leading-5 text-slate-500">
                                        {image.url}
                                      </p>
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
            </section>

            <section className="dashboard-panel flex min-h-0 flex-col overflow-hidden rounded-[2rem]">
              <PanelHeader
                icon={<ConfigureIcon />}
                label="Configuration"
                title="生成参数"
                subtitle="配置语言、比例、分辨率、模型和补充说明。"
                step="Step 2"
              />

              <div className={PANEL_SCROLL_AREA_CLASS}>
                <div className="space-y-4">
                  <section className="dashboard-subpanel rounded-[1.6rem] p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className={FIELD_LABEL_CLASS}>Source Language</label>
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
                        <label className={FIELD_LABEL_CLASS}>Target Language</label>
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
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <label className={FIELD_LABEL_CLASS}>Aspect Ratio</label>
                          <span className="text-xs text-slate-500">固定输出构图方向与投放画幅</span>
                        </div>
                        <div className="grid gap-2 md:grid-cols-3">
                          {ASPECT_RATIO_OPTIONS.map((option) => (
                            <OptionCard
                              key={option.id}
                              active={option.id === aspectRatio}
                              title={option.label}
                              description={option.description}
                              onClick={() => setAspectRatio(option.id)}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <label className={FIELD_LABEL_CLASS}>Resolution</label>
                          <p className="text-xs text-slate-500">1K 极速 2K 平衡 4K 较慢</p>
                        </div>
                        <div className="grid gap-2 lg:grid-cols-3">
                          {RESOLUTION_OPTIONS.map((resolution) => (
                            <OptionCard
                              key={resolution.id}
                              active={resolution.id === resolutionId}
                              title={resolution.label}
                              description={resolution.description}
                              onClick={() => setResolutionId(resolution.id)}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <label className={FIELD_LABEL_CLASS}>Creative Preset</label>
                          <span className="text-xs text-slate-500">保留商品信息前提下定义输出语气</span>
                        </div>
                        <div className="grid gap-2 lg:grid-cols-3">
                          {PROMPT_PRESETS.map((preset, index) => (
                            <PresetCard
                              key={preset.id}
                              active={preset.id === presetId}
                              title={preset.name}
                              description={preset.summary}
                              iconTone={index}
                              onClick={() => setPresetId(preset.id)}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className={FIELD_LABEL_CLASS}>Additional Notes</label>
                        <textarea
                          value={customPrompt}
                          onChange={(event) => setCustomPrompt(event.target.value)}
                          rows={3}
                          placeholder="例如：保留包装盒位置，突出防水卖点，整体风格更偏 Amazon 北美市场。"
                          className={cx(INPUT_BASE_CLASS, "min-h-28 resize-y")}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <label className={FIELD_LABEL_CLASS}>Model Family</label>
                          <span className="text-xs text-slate-500">分辨率会自动映射到对应模型版本</span>
                        </div>
                        <div className="grid gap-2 lg:grid-cols-2">
                          {MODEL_FAMILY_OPTIONS.map((modelFamily) => (
                            <ModelFamilyCard
                              key={modelFamily.id}
                              active={modelFamily.id === modelFamilyId}
                              title={modelFamily.label}
                              description={modelFamily.description}
                              priceLabel={modelFamily.priceLabel}
                              onClick={() => setModelFamilyId(modelFamily.id)}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="sm:col-span-2 rounded-[1.35rem] border border-orange-200 bg-[linear-gradient(180deg,rgba(255,242,235,0.95),rgba(255,250,246,0.98))] px-4 py-4 text-sm leading-6 text-slate-700">
                        <div className="flex items-start gap-3">
                          <span className="dashboard-icon-chip mt-0.5 h-10 w-10 rounded-[0.9rem] bg-white text-[color:var(--accent)]">
                            <SparkIcon />
                          </span>
                          <div className="min-w-0">
                            <p className="font-heading text-base font-bold text-slate-950">当前生成策略</p>
                            <p className="mt-1">
                              {activePreset.name}。系统会优先保留商品主体、构图和真实信息；
                              {sourceLanguage.trim()
                                ? `会把图中文字从 ${sourceLanguage.trim()} 转成 ${targetLanguage.trim()}。`
                                : "若检测到图中已有文字，会自动翻译成目标语言；若没有文字，则只做主图美化。"}
                            </p>
                            <p className="mt-2">输出画面会尽量按 {activeAspectRatio.label} 生成。</p>
                            <p className="mt-2 text-xs leading-6 text-slate-500">
                              如果商品站点禁止浏览器直接读取候选图，URL 抓图后可能无法直接生成，此时请把主图下载后改用本地上传。
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {formError ? (
                    <p className="rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {formError}
                    </p>
                  ) : null}

                  <div className="dashboard-subpanel flex flex-col gap-3 rounded-[1.6rem] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className={FIELD_LABEL_CLASS}>Render Setup</p>
                      <p className="font-heading text-lg font-bold text-slate-950">
                        {activeModelFamily.label} · {activeResolution.label}
                      </p>
                      <p className="truncate text-sm leading-6 text-slate-500">
                        当前模型 {activeModelName}，输出比例 {activeAspectRatio.id}，单次成本{" "}
                        {activeModelFamily.priceLabel}。
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={!canGenerate || isGenerating}
                      className="dashboard-dark-button inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap px-6 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <MagicWandIcon />
                      {isGenerating ? "正在生成主图..." : "生成优化图片"}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="dashboard-panel flex min-h-0 flex-col overflow-hidden rounded-[2rem]">
              <PanelHeader
                icon={<PreviewPanelIcon />}
                label="Preview & Result"
                title="预览与结果"
                subtitle="左看输入图，右看生成图，结果 URL 支持复制与下载。"
                step="Step 3"
              />

              <div className={PANEL_SCROLL_AREA_CLASS}>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <InlineStatusChip label="输出比例" value={activeAspectRatio.id} />
                    <InlineStatusChip label="分辨率" value={activeResolution.label} />
                    <InlineStatusChip label="模型" value={activeModelFamily.label} />
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <PreviewCard
                      eyebrow="Original Input"
                      title="原始主图"
                      subtitle={uploadMode === "file" ? "本地上传" : "URL 候选图"}
                      imageUrl={sourcePreview}
                      aspectRatio={activeAspectRatio.aspectRatio}
                      emptyState="上传主图，或先从商品 URL 中抓取并选择候选图。"
                      badge={sourcePreview ? "Source Ready" : ""}
                      onOpenImage={() => setIsComparisonOpen(true)}
                    />

                    <PreviewCard
                      eyebrow="AI Intelligence Layer"
                      title="生成结果"
                      subtitle={result ? "AI 输出" : "等待生成"}
                      imageUrl={result?.imageUrl ?? ""}
                      aspectRatio={activeAspectRatio.aspectRatio}
                      emptyState="完成配置后点击“生成优化图片”，这里会展示最终结果。"
                      badge={result?.imageUrl ? "Processed 100%" : "Waiting"}
                      accent
                      onOpenImage={() => setIsComparisonOpen(true)}
                    />
                  </div>

                  <div className="dashboard-subpanel rounded-[1.6rem] p-4">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <div className="min-w-0">
                        <p className={FIELD_LABEL_CLASS}>Result Delivery</p>
                        <p className="font-heading text-lg font-bold text-slate-950">生成图 URL</p>
                        <p className="truncate text-xs leading-6 text-slate-500">
                          支持直接复制，可用于回填运营流程、人工复核或跳转原图下载。
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2 whitespace-nowrap self-start">
                        <button
                          type="button"
                          onClick={handleCopyResultUrl}
                          disabled={!result?.imageUrl}
                          className="dashboard-secondary-button rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {copied ? "已复制" : "复制 URL"}
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadResultImage}
                          disabled={!result?.imageUrl}
                          className="dashboard-secondary-button rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          下载图片
                        </button>
                      </div>
                    </div>

                    <div className="dashboard-url-bar mt-3 px-4 py-3 text-xs leading-6">
                      {result?.imageUrl || "生成完成后，这里会展示服务商返回的图片 URL。"}
                    </div>

                    {result?.revisedPrompt ? (
                      <div className="mt-4 rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className={FIELD_LABEL_CLASS}>Revised Prompt</p>
                        <p className="font-heading text-base font-bold text-slate-950">
                          服务端返回的修订提示词
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-600">
                          {result.revisedPrompt}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
          </section>
        </div>
      </div>

      {isSettingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="关闭 API Key 设置"
            onClick={() => setIsSettingsOpen(false)}
          />
          <section className="dashboard-panel relative z-10 w-full max-w-lg rounded-[2rem] p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={FIELD_LABEL_CLASS}>API Key Settings</p>
                <h2 className="dashboard-brand text-3xl font-extrabold tracking-tight text-slate-950">
                  管理本地预览所用的 API Key
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  密钥只保存在当前浏览器本地，不写入服务器环境变量。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="dashboard-secondary-button inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500"
                aria-label="关闭设置"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className={FIELD_LABEL_CLASS}>API Key</label>
                  <button
                    type="button"
                    onClick={() => setApiKey("")}
                    className="text-xs font-medium text-slate-500 transition hover:text-slate-900"
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
                  className="dashboard-primary-button inline-flex min-h-11 flex-1 items-center justify-center px-5 text-sm font-semibold no-underline"
                >
                  获取 API Key
                </a>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="dashboard-secondary-button inline-flex min-h-11 flex-1 items-center justify-center px-5 text-sm font-semibold"
                >
                  完成
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {isComparisonOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 px-4 py-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="关闭对比预览"
            onClick={() => setIsComparisonOpen(false)}
          />
          <section className="relative z-10 flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#0f1217] shadow-[0_32px_100px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Compare Mode
                </p>
                <p className="mt-1 text-xl font-bold text-white">图片对比预览</p>
                <p className="truncate text-xs text-slate-300">
                  左侧查看原始主图，右侧查看生成结果，便于直接对比细节变化。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsComparisonOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                aria-label="关闭对比预览"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_40%),linear-gradient(180deg,rgba(24,28,35,0.98),rgba(12,14,18,0.98))] p-4 sm:p-6">
              <div className="grid min-w-[980px] gap-4 lg:grid-cols-2">
                <ComparisonPreviewCard
                  title="原始主图"
                  subtitle={uploadMode === "file" ? "本地上传" : "URL 候选图"}
                  imageUrl={sourcePreview}
                  aspectRatio={activeAspectRatio.aspectRatio}
                  emptyState="当前还没有可对比的原始主图。"
                />
                <ComparisonPreviewCard
                  title="生成结果"
                  subtitle={result ? "AI 输出" : "等待生成"}
                  imageUrl={result?.imageUrl ?? ""}
                  aspectRatio={activeAspectRatio.aspectRatio}
                  emptyState="当前还没有生成结果图。"
                />
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function PanelHeader({
  icon,
  label,
  title,
  subtitle,
  step,
}: {
  icon: ReactNode;
  label: string;
  title: string;
  subtitle: string;
  step: string;
}) {
  return (
    <div className={PANEL_HEADER_CLASS}>
      <div className="flex min-w-0 items-start gap-3">
        <span className="dashboard-icon-chip shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="mt-1 font-heading text-xl font-bold text-slate-950">{title}</p>
          <p className="mt-1 truncate text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      <span className={STEP_BADGE_CLASS}>{step}</span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="dashboard-status-card rounded-[1.35rem] px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 font-heading text-lg font-bold leading-6 text-slate-950">{value}</p>
    </div>
  );
}

function InlineStatusChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-600 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
      <span className="font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function ModeCard({
  title,
  description,
  active,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  active: boolean;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "dashboard-subpanel flex min-h-[8.5rem] flex-col rounded-[1.35rem] p-4 text-left transition",
        active
          ? "border-[color:var(--border-strong)] bg-[linear-gradient(180deg,rgba(255,240,232,0.96),rgba(255,248,243,0.98))] ring-2 ring-[color:var(--accent-ring)]"
          : "hover:border-[color:var(--border-strong)] hover:bg-white",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={cx(
            "dashboard-icon-chip h-10 w-10 rounded-[0.95rem]",
            active ? "bg-white text-[color:var(--accent)]" : "bg-slate-100 text-slate-500",
          )}
        >
          {icon}
        </span>
        <span
          className={cx(
            "h-2.5 w-2.5 rounded-full transition",
            active ? "bg-[color:var(--accent)] shadow-[0_0_0_5px_rgba(201,76,22,0.12)]" : "bg-slate-200",
          )}
        />
      </div>
      <p className="mt-4 font-heading text-lg font-bold text-slate-950">{title}</p>
      <p className="mt-1 text-xs leading-6 text-slate-500">{description}</p>
    </button>
  );
}

function OptionCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "dashboard-subpanel rounded-[1.2rem] px-3 py-3 text-left transition",
        active
          ? "border-[color:var(--border-strong)] bg-[linear-gradient(180deg,rgba(255,241,233,0.98),rgba(255,249,245,1))] ring-2 ring-[color:var(--accent-ring)]"
          : "hover:border-[color:var(--border-strong)] hover:bg-white",
      )}
    >
      <p className="font-heading text-base font-bold text-slate-950">{title}</p>
      <p className="mt-1.5 text-xs leading-5 text-slate-500">{description}</p>
    </button>
  );
}

function PresetCard({
  active,
  title,
  description,
  iconTone,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  iconTone: number;
  onClick: () => void;
}) {
  const tones = [
    "bg-sky-100 text-sky-700",
    "bg-emerald-100 text-emerald-700",
    "bg-orange-100 text-orange-700",
  ];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "dashboard-subpanel rounded-[1.2rem] px-3 py-3 text-left transition",
        active
          ? "border-[color:var(--border-strong)] bg-[linear-gradient(180deg,rgba(255,241,233,0.98),rgba(255,249,245,1))] ring-2 ring-[color:var(--accent-ring)]"
          : "hover:border-[color:var(--border-strong)] hover:bg-white",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cx(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.9rem] text-sm font-bold",
            tones[iconTone % tones.length],
          )}
        >
          {title.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="font-heading text-base font-bold text-slate-950">{title}</p>
          <p className="mt-1.5 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
    </button>
  );
}

function ModelFamilyCard({
  active,
  title,
  description,
  priceLabel,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  priceLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-[1.35rem] border px-4 py-4 text-left transition",
        active
          ? "border-slate-900 bg-[linear-gradient(180deg,#23272f,#12151b)] text-white shadow-[0_22px_40px_rgba(15,23,42,0.18)]"
          : "dashboard-subpanel hover:border-slate-300 hover:bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading text-lg font-bold">{title}</p>
          <p className={cx("mt-2 text-xs leading-6", active ? "text-slate-200" : "text-slate-500")}>
            {description}
          </p>
        </div>
        <span
          className={cx(
            "rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap",
            active ? "bg-white/10 text-white" : "bg-[var(--accent-soft)] text-[color:var(--accent)]",
          )}
        >
          {priceLabel}
        </span>
      </div>
    </button>
  );
}

function PreviewCard({
  eyebrow,
  title,
  subtitle,
  imageUrl,
  aspectRatio,
  emptyState,
  badge,
  accent = false,
  onOpenImage,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  aspectRatio: string;
  emptyState: string;
  badge: string;
  accent?: boolean;
  onOpenImage: () => void;
}) {
  return (
    <article
      className={cx(
        "overflow-hidden rounded-[1.55rem] border bg-white shadow-[0_16px_35px_rgba(15,23,42,0.06)]",
        accent ? "border-orange-200" : "border-slate-200",
      )}
    >
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <div>
            <p className="font-heading text-lg font-bold text-slate-950">{title}</p>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
          {badge ? (
            <span
              className={cx(
                "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                accent
                  ? "bg-[color:var(--accent)] text-white"
                  : "bg-slate-100 text-slate-600",
              )}
            >
              {badge}
            </span>
          ) : null}
        </div>
      </div>

      <div className={cx(accent ? "dashboard-preview-surface-accent" : "dashboard-preview-surface")} style={{ aspectRatio }}>
        {imageUrl ? (
          <button
            type="button"
            onClick={onOpenImage}
            className="group relative block h-full w-full cursor-zoom-in p-4"
            aria-label={`放大预览${title}`}
          >
            <img
              src={imageUrl}
              alt={title}
              className={cx(
                "h-full w-full rounded-[1.35rem] object-contain",
                accent
                  ? "shadow-[0_20px_48px_rgba(201,76,22,0.18)]"
                  : "shadow-[0_18px_38px_rgba(15,23,42,0.1)]",
              )}
            />
            <div className="absolute inset-x-4 bottom-4 flex items-center justify-between rounded-[1.05rem] bg-white/86 px-3 py-2 text-xs text-slate-600 opacity-0 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur-md transition group-hover:opacity-100">
              <span className="font-semibold text-slate-900">{title}</span>
              <span>点击放大对比</span>
            </div>
          </button>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm leading-7 text-slate-500">
            {emptyState}
          </div>
        )}
      </div>
    </article>
  );
}

function ComparisonPreviewCard({
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
    <article className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/5 backdrop-blur-sm">
      <div className="border-b border-white/10 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{subtitle}</p>
        <p className="mt-1 text-lg font-bold text-white">{title}</p>
      </div>
      <div
        className="flex items-center justify-center bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4"
        style={{ aspectRatio }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="max-h-full w-auto max-w-full rounded-[1.2rem] object-contain shadow-[0_18px_60px_rgba(0,0,0,0.35)]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-center text-sm leading-7 text-slate-300">
            {emptyState}
          </div>
        )}
      </div>
    </article>
  );
}

function SourceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5h6l1.8 2.4H21v7.8A1.8 1.8 0 0 1 19.2 19.5H4.8A1.8 1.8 0 0 1 3 17.7V7.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 14h8" />
    </svg>
  );
}

function ConfigureIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
      <circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PreviewPanelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}

function UploadModeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0 4 4m-4-4-4 4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15.5v2.3A1.2 1.2 0 0 0 6.2 19h11.6a1.2 1.2 0 0 0 1.2-1.2v-2.3" />
    </svg>
  );
}

function LinkModeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m10 14-2 2a3 3 0 1 1-4.243-4.243l3.536-3.535A3 3 0 0 1 11.536 8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m14 10 2-2a3 3 0 1 1 4.243 4.243l-3.536 3.535A3 3 0 0 1 12.464 16" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 15 9" />
    </svg>
  );
}

function ImageStackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m7.5 14.5 3.2-3.2 2.3 2.3 2.3-2.3 2.2 3.2" />
      <circle cx="9" cy="10" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M12 2.5 13.9 8l5.6 1.9-5.6 1.9L12 17.5l-1.9-5.7L4.5 9.9 10.1 8 12 2.5Zm6 11 1 2.8 2.8 1-2.8 1-1 2.7-1-2.7-2.7-1 2.7-1 1-2.8Z" />
    </svg>
  );
}

function MagicWandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4.5 w-4.5 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4 20 8.7-8.7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m11.5 5.5 1-2.5 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m17.5 12.5.7-1.7.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.2 9.8 2 2-7.6 7.6a1.4 1.4 0 0 1-2 0l-.4-.4a1.4 1.4 0 0 1 0-2l7.6-7.6Z" />
    </svg>
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
