"use client";

import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
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
import {
  buildGenerationAttempts,
  coerceGenerationSelection,
  getModelFamilyDisplayAttempt,
  getResolutionPriceChangeNotice,
  getSupportedAspectRatioIds,
  getSupportedResolutionIds,
  normalizeGeneratedImageResult,
  supportsSellingPointExtraction,
  type GenerationAttempt,
  type ImageApiPayload,
} from "@/lib/image-generation";
import { buildGenerationPrompt } from "@/lib/prompt";
import { parseSellingPoints } from "@/lib/selling-points";
import type {
  AspectRatioId,
  ExtractedImageCandidate,
  GenerateImageResponse,
  ModelFamilyId,
  PromptPresetId,
  ResolutionId,
  SellingPointItem,
} from "@/lib/types";

type UploadMode = "file" | "url";

type GenerateImageApiResponse = {
  payload?: ImageApiPayload;
  attempt?: GenerationAttempt;
  requestedModelFamilyId?: ModelFamilyId;
  requestedModel?: string;
  error?: string;
};

const INPUT_BASE_CLASS =
  "w-full rounded-md border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition placeholder:text-[var(--muted)] focus:border-[color:var(--accent)] focus:bg-white focus:ring-2 focus:ring-[color:var(--accent-ring)]";
const FIELD_LABEL_CLASS =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ink3)]";
const PANEL_HEADER_CLASS =
  "dashboard-panel-header flex items-center justify-between gap-4 px-4 py-3";
const PANEL_SCROLL_AREA_CLASS =
  "scrollbar-soft scrollbar-soft-desktop min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pt-[5px] pb-4";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function buildProxyImageUrl(imageUrl: string) {
  return imageUrl ? `/api/image-proxy?url=${encodeURIComponent(imageUrl)}` : "";
}

async function fetchImageAsDataUrl(imageUrl: string): Promise<string | null> {
  if (!imageUrl || imageUrl.startsWith("data:") || imageUrl.startsWith("blob:")) {
    return imageUrl || null;
  }
  try {
    const response = await fetch(buildProxyImageUrl(imageUrl));
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function getMimeTypeFromDataUrl(dataUrl: string) {
  const matches = dataUrl.match(/^data:(image\/[^;]+);base64,/i);

  return matches?.[1]?.toLowerCase() || "image/png";
}

function getExtensionFromMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  return mimeType.split("/")[1] || "png";
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
  const [selectionNotice, setSelectionNotice] = useState("");
  const [resolutionNotice, setResolutionNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [extractSellingPoints, setExtractSellingPoints] = useState(false);
  const [adjustProductAngle, setAdjustProductAngle] = useState(false);
  const [matchBackgroundToProductInfo, setMatchBackgroundToProductInfo] = useState(false);
  const [sellingPointsResult, setSellingPointsResult] = useState<SellingPointItem[] | null>(null);
  const [sellingPointsError, setSellingPointsError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copiedSellingPoints, setCopiedSellingPoints] = useState(false);

  useEffect(() => {
    const storedApiKey = window.localStorage.getItem(API_KEY_STORAGE_KEY);

    if (storedApiKey) {
      setApiKey(storedApiKey);
    } else {
      setIsSettingsOpen(true);
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
    return () => {
      if (result?.deliveryKind === "local-data" && result.imageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(result.imageUrl);
      }
    };
  }, [result]);

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

  const handleGenerateRef = useRef<() => void>(() => {});

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key === "Enter";
      if (!isShortcut) {
        return;
      }
      event.preventDefault();
      handleGenerateRef.current();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const activeModelFamily =
    MODEL_FAMILY_OPTIONS.find((item) => item.id === modelFamilyId) ?? MODEL_FAMILY_OPTIONS[0];
  const selectableModelFamilies = MODEL_FAMILY_OPTIONS.filter((item) => item.selectable !== false);
  const supportedAspectRatioIds = getSupportedAspectRatioIds(activeModelFamily.id);
  const supportedResolutionIds = getSupportedResolutionIds(activeModelFamily.id);
  const visibleAspectRatioOptions = ASPECT_RATIO_OPTIONS.filter((item) =>
    supportedAspectRatioIds.includes(item.id),
  );
  const activeResolution =
    RESOLUTION_OPTIONS.find((item) => item.id === resolutionId) ?? RESOLUTION_OPTIONS[1];
  const activeAspectRatio =
    ASPECT_RATIO_OPTIONS.find((item) => item.id === aspectRatio) ?? ASPECT_RATIO_OPTIONS[0];
  const primaryAttempt = buildGenerationAttempts({
    modelFamilyId: activeModelFamily.id,
    resolutionId,
    aspectRatioId: aspectRatio,
  })[0];
  const sourcePreview =
    uploadMode === "file" ? filePreviewUrl : buildProxyImageUrl(selectedImageUrl);
  const resultAspectRatio =
    ASPECT_RATIO_OPTIONS.find((item) => item.id === result?.aspectRatioId) ?? activeAspectRatio;
  const resultResolution =
    RESOLUTION_OPTIONS.find((item) => item.id === result?.resolutionId) ?? activeResolution;
  const requestedResultModelFamily =
    MODEL_FAMILY_OPTIONS.find((item) => item.id === result?.requestedModelFamilyId) ??
    activeModelFamily;
  const resultModelLabel = result?.actualModelLabel ?? activeModelFamily.label;
  const canExtractSellingPoints = supportsSellingPointExtraction({
    modelFamilyId: activeModelFamily.id,
    resolutionId,
    aspectRatioId: aspectRatio,
  });
  const canGenerate =
    apiKey.trim().length > 0 &&
    targetLanguage.trim().length > 0 &&
    ((uploadMode === "file" && Boolean(selectedFile)) ||
      (uploadMode === "url" && Boolean(selectedImageUrl)));
  const sellingPointsFromResponse = result?.sellingPoints ?? sellingPointsResult;
  const isSellingPointsEmptyState =
    sellingPointsFromResponse !== undefined &&
    sellingPointsFromResponse !== null &&
    sellingPointsFromResponse.length === 0;
  const showSellingPointsPanel =
    extractSellingPoints && Boolean(result?.imageUrl);
  const costSummary = `预估 ${primaryAttempt.priceLabel} · ${activeResolution.label} · ${activeAspectRatio.id}`;

  function handleModelFamilyChange(nextModelFamilyId: ModelFamilyId) {
    const nextSelection = coerceGenerationSelection({
      modelFamilyId: nextModelFamilyId,
      aspectRatioId: aspectRatio,
      resolutionId,
    });
    const nextCanExtractSellingPoints = supportsSellingPointExtraction({
      modelFamilyId: nextModelFamilyId,
      resolutionId: nextSelection.resolutionId,
      aspectRatioId: nextSelection.aspectRatioId,
    });
    const notices = [nextSelection.message];

    if (!nextCanExtractSellingPoints && extractSellingPoints) {
      notices.push("当前模型返回本地预览图片，不支持提炼图片卖点，已自动关闭该功能。");
    }

    setModelFamilyId(nextModelFamilyId);
    setAspectRatio(nextSelection.aspectRatioId);
    setResolutionId(nextSelection.resolutionId);
    setSelectionNotice(notices.filter(Boolean).join(" "));
    setResolutionNotice("");
    if (!nextCanExtractSellingPoints && extractSellingPoints) {
      setExtractSellingPoints(false);
      setSellingPointsResult(null);
      setSellingPointsError(null);
    }
    setFormError("");
  }

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

  const VISION_MODELS = [
    "gemini-3.1-flash-lite-preview",
    "gpt-5.4-nano",
    "gpt-5.3-codex",
    "gemini-3.1-pro-preview",
  ];

  async function analyzeSellingPoints(imageUrl: string): Promise<string> {
    const analysisUrl = await fetchImageAsDataUrl(imageUrl) ?? imageUrl;

    for (const model of VISION_MODELS) {
      try {
        const response = await fetch(`${API_BASE_URL}/v1/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey.trim()}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "user",
                content: [
                  { type: "image_url", image_url: { url: analysisUrl } },
                  {
                    type: "text",
                    text: `请识别图片中所有可见的卖点文字（短语或关键词）。严格按以下格式输出，每行一个条目，不允许合并、跳过或添加任何其他内容：\n原文文字 → 中文翻译\n原文文字 → 中文翻译\n每行必须单独占一行，使用 → 分隔。如果图中没有任何文字，只回复"未检测到卖点文字"。`,
                  },
                ],
              },
            ],
            max_tokens: 1000,
          }),
        });

        if (!response.ok) continue;

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content === "string" && content.trim()) {
          return content.trim();
        }
      } catch {
        // try next model
      }
    }
    throw new Error("卖点识别失败，所有模型均无响应。");
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
    setSellingPointsResult(null);
    setSellingPointsError(null);

    try {
      const sourceFile = await resolveSourceFile();
      const prompt = buildGenerationPrompt({
        sourceLanguage: sourceLanguage.trim() || undefined,
        targetLanguage: targetLanguage.trim(),
        aspectRatio,
        presetId,
        customPrompt: customPrompt.trim() || undefined,
        extractSellingPoints,
        adjustProductAngle,
        matchBackgroundToProductInfo,
      });
      const body = new FormData();
      body.append("prompt", prompt);
      body.append("modelFamilyId", activeModelFamily.id);
      body.append("resolutionId", resolutionId);
      body.append("aspectRatioId", aspectRatio);
      body.append("image", sourceFile, sourceFile.name);

      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          Accept: "application/json",
        },
        body,
      });
      const payload = (await response.json()) as GenerateImageApiResponse;

      if (
        !response.ok ||
        !payload.payload ||
        !payload.attempt ||
        !payload.requestedModelFamilyId ||
        !payload.requestedModel
      ) {
        throw new Error(payload.error ?? "图片生成失败，请稍后重试。");
      }

      const generatedResult = normalizeGeneratedImageResult({
        payload: payload.payload,
        attempt: payload.attempt,
        createObjectUrl: URL.createObjectURL,
        requestedModelFamilyId: payload.requestedModelFamilyId,
        requestedModel: payload.requestedModel,
        aspectRatioId: aspectRatio,
        resolutionId,
      });
      setResult(generatedResult);

      if (extractSellingPoints && canExtractSellingPoints) {
        setIsAnalyzing(true);
        try {
          const translation = await analyzeSellingPoints(generatedResult.analysisImageUrl);
          const parsed = parseSellingPoints(translation);
          setSellingPointsResult(parsed);
        } catch {
          setSellingPointsResult([]);
          setSellingPointsError("卖点识别失败，请手动查看图片。");
        } finally {
          setIsAnalyzing(false);
        }
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "图片生成失败，请稍后重试。");
    } finally {
      setIsGenerating(false);
    }
  }

  handleGenerateRef.current = () => {
    if (!canGenerate || isGenerating) {
      return;
    }
    void handleGenerate();
  };

  async function handleCopySellingPoints() {
    if (!sellingPointsFromResponse?.length) {
      return;
    }
    const text = sellingPointsFromResponse
      .map((item) => `${item.target} — ${item.zh}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopiedSellingPoints(true);
    window.setTimeout(() => setCopiedSellingPoints(false), 1500);
  }

  async function handleCopyResultUrl() {
    if (!result?.copyableImageUrl) {
      return;
    }

    await navigator.clipboard.writeText(result.copyableImageUrl);
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
      if (result.deliveryKind === "local-data") {
        const link = document.createElement("a");
        const mimeType = getMimeTypeFromDataUrl(result.analysisImageUrl);
        const extension = getExtensionFromMimeType(mimeType);

        link.href = result.imageUrl;
        link.download = `listinglens-result-${result.aspectRatioId.replace(":", "x")}.${extension}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }

      const response = await fetch(result.imageUrl);

      if (!response.ok) {
        throw new Error(`下载失败，服务端返回 ${response.status}。`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const extension = blob.type.split("/")[1] || "png";

      link.href = objectUrl;
      link.download = `listinglens-result-${result.aspectRatioId.replace(":", "x")}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setFormError(
        result.deliveryKind === "local-data"
          ? "当前模型结果下载失败，请重新生成后再试。"
          : "当前图片源不支持直接下载，请先复制 URL 后在新标签页打开下载。",
      );
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
    <main className="flex h-screen flex-col overflow-hidden bg-[var(--background)] text-[var(--ink)]">
      {/* Compact top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--panel)] px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-900">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="h-3.5 w-3.5">
              <circle cx="11" cy="11" r="6" />
              <path strokeLinecap="round" d="M19 19l-3.5-3.5" />
            </svg>
          </div>
          <span className="font-serif text-[18px] tracking-[-0.3px] text-[var(--ink)]">{APP_NAME}</span>
          <span className="ml-0.5 text-[11px] text-[var(--ink3)]">跨境电商商品图片优化/本地化工作台</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] text-[var(--ink3)]">
            <span
              className={cx(
                "h-1.5 w-1.5 rounded-full",
                apiKey.trim() ? "bg-[color:var(--accent)]" : "bg-[var(--muted)]",
              )}
            />
            {apiKey.trim() ? "API Key 已保存" : "未设置 API Key"}
          </span>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="dashboard-secondary-button flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
            aria-label="API Key 设置"
          >
            <GearIcon />
            设置
          </button>
        </div>
      </header>

      {/* 3-column workbench */}
      <div className="flex min-h-0 flex-1 gap-2.5 p-2.5">
          <section className="grid min-h-0 flex-1 gap-2.5 grid-cols-[minmax(280px,0.7fr)_minmax(380px,1fr)_minmax(440px,1.1fr)]">
            {/* ── Step 1: Source ── */}
            <section className="dashboard-panel flex min-h-0 flex-col overflow-hidden rounded-lg">
              <PanelHeader title="图片来源" step="Step 1" />

              <div className={PANEL_SCROLL_AREA_CLASS}>
                <div className="space-y-3">
                  {/* Segmented mode control */}
                  <div className="grid grid-cols-2 gap-0.5 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] p-0.5">
                    {(["file", "url"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setUploadMode(mode)}
                        className={cx(
                          "flex items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition",
                          uploadMode === mode
                            ? "bg-[var(--panel)] text-[var(--ink)] shadow-sm"
                            : "text-[var(--ink3)] hover:text-[var(--ink2)]",
                        )}
                      >
                        {mode === "file" ? <UploadModeIcon /> : <LinkModeIcon />}
                        {mode === "file" ? "本地上传" : "URL 抓图"}
                      </button>
                    ))}
                  </div>

                  {uploadMode === "file" ? (
                    <>
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
                        className={cx(
                          "flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition",
                          selectedFile
                            ? "border-[var(--border)] bg-[var(--panel)] hover:border-[color:var(--accent)]"
                            : "border-dashed border-[var(--border)] bg-[var(--panel-soft)] hover:border-[color:var(--accent)] hover:bg-[var(--panel)]",
                        )}
                      >
                        {selectedFile ? (
                          <>
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-[var(--border)] bg-[var(--panel-soft)]">
                              {filePreviewUrl && (
                                <img src={filePreviewUrl} alt="" className="h-full w-full object-cover" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[12.5px] font-medium text-[var(--ink)]">{selectedFile.name}</p>
                              <p className="text-[11px] text-[var(--ink3)]">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB · 已就绪</p>
                            </div>
                            <span className="shrink-0 text-[11px] text-[color:var(--accent)]">更换</span>
                          </>
                        ) : (
                          <div className="flex w-full flex-col items-center py-6 text-center">
                            <UploadModeIcon />
                            <p className="mt-2 text-[12.5px] font-medium text-[var(--ink2)]">点击或拖拽上传主图</p>
                            <p className="mt-1 text-[11px] text-[var(--ink3)]">支持 JPG / PNG / WEBP / AVIF，建议 2000px 以上</p>
                          </div>
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className={FIELD_LABEL_CLASS}>商品图片链接</p>
                      <div className="flex gap-2">
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
                          className="dashboard-dark-button shrink-0 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isExtracting ? "抓取中…" : "抓取"}
                        </button>
                      </div>

                      {extractError ? (
                        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                          {extractError}
                        </p>
                      ) : null}

                      {extractedImages.length ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className={FIELD_LABEL_CLASS}>候选主图 · 点击选中</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {extractedImages.map((image) => {
                              const isSelected = selectedImageUrl === image.url;
                              return (
                                <button
                                  key={image.url}
                                  type="button"
                                  onClick={() => { setSelectedImageUrl(image.url); setFormError(""); }}
                                  className={cx(
                                    "overflow-hidden rounded border text-left transition",
                                    isSelected
                                      ? "border-[color:var(--accent)]"
                                      : "border-[var(--border)] hover:border-[color:var(--accent)]",
                                  )}
                                >
                                  <div className="aspect-[4/3] overflow-hidden bg-[var(--panel-soft)]">
                                    <img src={buildProxyImageUrl(image.url)} alt="" className="h-full w-full object-cover" />
                                  </div>
                                  <div className="flex items-center justify-between px-2 py-1.5">
                                    <p className="truncate text-[10.5px] font-mono text-[var(--ink3)]">{image.source}</p>
                                    {isSelected && (
                                      <span className="ml-1 shrink-0 text-[10px] font-semibold text-[color:var(--accent)]">✓</span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* ── Step 2: Config ── */}
            <section className="dashboard-panel flex min-h-0 flex-col overflow-hidden rounded-lg">
              <PanelHeader title="生成参数" step="Step 2" />

              <div className={PANEL_SCROLL_AREA_CLASS}>
                <div className="space-y-4">

                  {/* Model radio list */}
                  <div>
                    <p className={FIELD_LABEL_CLASS}>模型系列</p>
                    <div className="flex flex-col gap-1">
                      {selectableModelFamilies.map((modelFamily) => {
                        const active = modelFamily.id === modelFamilyId;
                        const displayAttempt = getModelFamilyDisplayAttempt({ modelFamilyId: modelFamily.id, resolutionId, aspectRatioId: aspectRatio });
                        return (
                          <button
                            key={modelFamily.id}
                            type="button"
                            onClick={() => handleModelFamilyChange(modelFamily.id)}
                            className={cx(
                              "flex items-center gap-2.5 rounded-md border px-3 py-2 text-left transition",
                              active
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-[var(--border)] bg-[var(--panel)] text-[var(--ink)] hover:border-[var(--ink2)]",
                            )}
                          >
                            <span className={cx(
                              "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition",
                              active ? "border-white bg-white" : "border-[var(--ink3)] bg-transparent",
                            )}>
                              {active && <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className={cx("text-[12.5px] font-semibold", active ? "text-white" : "text-[var(--ink)]")}>
                                {modelFamily.label}
                              </span>
                              <span className={cx("ml-2 truncate text-[11px]", active ? "text-white/65" : "text-[var(--ink3)]")}>
                                {modelFamily.description}
                              </span>
                            </div>
                            <span className={cx("shrink-0 font-mono-code text-[11px] tabular-nums", active ? "text-white/80" : "text-[var(--ink2)]")}>
                              {displayAttempt.priceLabel}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {selectionNotice ? (
                      <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{selectionNotice}</p>
                    ) : null}
                  </div>

                  {/* Languages */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className={FIELD_LABEL_CLASS}>源语言</p>
                      <select value={sourceLanguage} onChange={(e) => setSourceLanguage(e.target.value)} className={cx(INPUT_BASE_CLASS, "!text-xs")}>
                        <option value="">自动识别</option>
                        {LANGUAGE_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className={FIELD_LABEL_CLASS}>目标语言</p>
                      <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} className={cx(INPUT_BASE_CLASS, "!text-xs")} required>
                        {LANGUAGE_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Aspect ratio visual thumbnails */}
                  <div>
                    <p className={FIELD_LABEL_CLASS}>输出比例</p>
                    <div className="grid grid-cols-7 gap-1">
                      {visibleAspectRatioOptions.map((option) => {
                        const active = option.id === aspectRatio;
                        const [w, h] = option.aspectRatio.split(" / ").map(Number);
                        const maxW = 32; const maxH = 32;
                        const scale = Math.min(maxW / w, maxH / h);
                        const tw = Math.round(w * scale); const th = Math.round(h * scale);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            title={option.label}
                            onClick={() => { setAspectRatio(option.id); setSelectionNotice(""); setResolutionNotice(""); setFormError(""); }}
                            className={cx(
                              "flex aspect-square flex-col items-center justify-center gap-1 rounded border transition",
                              active
                                ? "border-[color:var(--accent)] bg-[var(--accent-soft)]"
                                : "border-[var(--border)] bg-[var(--panel)] hover:border-[var(--ink3)]",
                            )}
                          >
                            <div
                              style={{ width: tw, height: th }}
                              className={cx(
                                "rounded-[1px] border",
                                active ? "border-[color:var(--accent)]" : "border-[var(--ink3)]",
                              )}
                            />
                            <span className={cx("font-mono-code text-[8.5px] leading-none tabular-nums", active ? "text-[color:var(--accent-strong)]" : "text-[var(--ink3)]")}>
                              {option.id}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Resolution */}
                  <div>
                    <p className={FIELD_LABEL_CLASS}>分辨率</p>
                    <div className="grid grid-cols-3 gap-1">
                      {RESOLUTION_OPTIONS.map((resolution) => {
                        const active = resolution.id === resolutionId;
                        const disabled = !supportedResolutionIds.includes(resolution.id);
                        return (
                          <button
                            key={resolution.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              setResolutionNotice(getResolutionPriceChangeNotice({ modelFamilyId: activeModelFamily.id, currentResolutionId: resolutionId, nextResolutionId: resolution.id, aspectRatioId: aspectRatio }));
                              setResolutionId(resolution.id);
                              setSelectionNotice(""); setFormError("");
                            }}
                            className={cx(
                              "rounded-md border px-2 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40",
                              active
                                ? "border-[color:var(--accent)] bg-[var(--accent-soft)]"
                                : "border-[var(--border)] bg-[var(--panel)] hover:border-[var(--ink3)]",
                            )}
                          >
                            <p className={cx("text-[12px] font-semibold", active ? "text-[color:var(--accent-strong)]" : "text-[var(--ink)]")}>{resolution.label}</p>
                            <p className={cx("text-[10px]", active ? "text-[color:var(--accent)]" : "text-[var(--ink3)]")}>{resolution.description}</p>
                          </button>
                        );
                      })}
                    </div>
                    {resolutionNotice ? (
                      <p className="mt-1.5 rounded border border-[color:var(--accent-soft)] bg-[var(--accent-soft)] px-3 py-1.5 text-[11px] text-[color:var(--accent-strong)]">{resolutionNotice}</p>
                    ) : null}
                  </div>

                  {/* Preset radio list */}
                  <div>
                    <p className={FIELD_LABEL_CLASS}>创意预设</p>
                    <div className="flex flex-col gap-1">
                      {PROMPT_PRESETS.map((preset) => {
                        const active = preset.id === presetId;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setPresetId(preset.id)}
                            className={cx(
                              "flex items-center gap-2.5 rounded-md border px-3 py-2 text-left transition",
                              active
                                ? "border-[var(--border)] bg-[var(--panel-soft)]"
                                : "border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel-soft)]",
                            )}
                          >
                            <span className={cx(
                              "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition",
                              active ? "border-slate-900 bg-slate-900" : "border-[var(--ink3)] bg-transparent",
                            )}>
                              {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                            </span>
                            <div className="min-w-0">
                              <span className="text-[12.5px] font-medium text-[var(--ink)]">{preset.name}</span>
                              <span className="ml-1.5 text-[11px] text-[var(--ink3)]">{preset.summary}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                  </div>

                  {/* Image adjustments */}
                  <div>
                    <p className={FIELD_LABEL_CLASS}>图片调整 <span className="normal-case font-normal text-[var(--muted)]">· 可选</span></p>
                    <div className="flex flex-col gap-1.5">
                      {/* Extract selling points */}
                      <button
                        type="button"
                        disabled={!canExtractSellingPoints}
                        onClick={() => setExtractSellingPoints(!extractSellingPoints)}
                        className={cx(
                          "flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                          extractSellingPoints && canExtractSellingPoints
                            ? "border-[color:var(--accent)] bg-[var(--accent-soft)]"
                            : "border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel-soft)]",
                        )}
                      >
                        <span className={cx(
                          "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition",
                          extractSellingPoints && canExtractSellingPoints
                            ? "border-[color:var(--accent)] bg-[color:var(--accent)]"
                            : "border-[var(--ink3)] bg-transparent",
                        )}>
                          {extractSellingPoints && canExtractSellingPoints && (
                            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                              <path d="M1 3.5l2.2 2.2L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className={cx("text-[12.5px] font-medium", extractSellingPoints && canExtractSellingPoints ? "text-[color:var(--accent-strong)]" : "text-[var(--ink)]")}>
                            提炼图片卖点
                          </span>
                          <span className="ml-1.5 text-[11px] text-[var(--ink3)]">
                            {canExtractSellingPoints ? "生成后识别卖点文字并提供中文对照" : "当前模型不支持卖点提炼"}
                          </span>
                        </div>
                      </button>

                      {/* Adjust product angle */}
                      <button
                        type="button"
                        onClick={() => setAdjustProductAngle(!adjustProductAngle)}
                        className={cx(
                          "flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left transition",
                          adjustProductAngle
                            ? "border-[color:var(--accent)] bg-[var(--accent-soft)]"
                            : "border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel-soft)]",
                        )}
                      >
                        <span className={cx(
                          "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition",
                          adjustProductAngle
                            ? "border-[color:var(--accent)] bg-[color:var(--accent)]"
                            : "border-[var(--ink3)] bg-transparent",
                        )}>
                          {adjustProductAngle && (
                            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                              <path d="M1 3.5l2.2 2.2L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className={cx("text-[12.5px] font-medium", adjustProductAngle ? "text-[color:var(--accent-strong)]" : "text-[var(--ink)]")}>
                            修改商品角度
                          </span>
                          <span className="ml-1.5 text-[11px] text-[var(--ink3)]">调整商品展示视角，保持细节不变</span>
                        </div>
                      </button>

                      {/* Match background to product info */}
                      <button
                        type="button"
                        onClick={() => setMatchBackgroundToProductInfo(!matchBackgroundToProductInfo)}
                        className={cx(
                          "flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left transition",
                          matchBackgroundToProductInfo
                            ? "border-[color:var(--accent)] bg-[var(--accent-soft)]"
                            : "border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel-soft)]",
                        )}
                      >
                        <span className={cx(
                          "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition",
                          matchBackgroundToProductInfo
                            ? "border-[color:var(--accent)] bg-[color:var(--accent)]"
                            : "border-[var(--ink3)] bg-transparent",
                        )}>
                          {matchBackgroundToProductInfo && (
                            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                              <path d="M1 3.5l2.2 2.2L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className={cx("text-[12.5px] font-medium", matchBackgroundToProductInfo ? "text-[color:var(--accent-strong)]" : "text-[var(--ink)]")}>
                            根据商品信息匹配背景
                          </span>
                          <span className="ml-1.5 text-[11px] text-[var(--ink3)]">根据商品用途与属性，匹配更适合的场景背景，不添加卖点文字</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Custom prompt */}
                  <div>
                    <p className={FIELD_LABEL_CLASS}>补充说明 <span className="normal-case font-normal text-[var(--muted)]">· 可选</span></p>
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      rows={3}
                      placeholder="例如：保留产品位置，突出防水卖点，整体风格偏 TikTokShop 菲律宾市场。"
                      className={cx(INPUT_BASE_CLASS, "resize-y !text-xs")}
                    />
                  </div>

                  {formError ? (
                    <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3 border-t border-slate-200/80 bg-[var(--panel-soft)] px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                    配置完成后生成
                  </p>
                  <p className="mt-0.5 truncate text-[11px] tabular-nums text-slate-600">
                    {costSummary}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerate || isGenerating}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isGenerating ? (
                    <SpinnerIcon />
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                      <path d="M12 2.5 13.9 8l5.6 1.9-5.6 1.9L12 17.5l-1.9-5.7L4.5 9.9 10.1 8 12 2.5Z" />
                    </svg>
                  )}
                  {isGenerating ? "生成中…" : "生成主图"}
                  {!isGenerating ? (
                    <span className="text-[10px] font-normal opacity-60">⌘⏎</span>
                  ) : null}
                </button>
              </div>
            </section>

            <section className="dashboard-panel flex min-h-0 flex-col overflow-hidden rounded-lg">
              <PanelHeader title="预览与输出" step="Step 3" />

              <div className={PANEL_SCROLL_AREA_CLASS}>
                <div className="space-y-3">
                  {/* Status chips row */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { label: "比例", value: resultAspectRatio.id },
                      { label: "分辨率", value: resultResolution.label },
                      { label: "模型", value: resultModelLabel },
                    ].map(({ label, value }) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--panel-soft)] px-2 py-0.5 text-[10.5px] text-[var(--ink3)]"
                      >
                        <span className="font-semibold uppercase tracking-[0.12em]">{label}</span>
                        <span className="text-[var(--ink2)]">{value}</span>
                      </span>
                    ))}
                  </div>

                  <div className="grid gap-3 xl:grid-cols-2">
                    <PreviewCard
                      key={sourcePreview || "source-empty"}
                      title="原始主图"
                      subtitle={uploadMode === "file" ? "本地上传" : "URL 候选图"}
                      imageUrl={sourcePreview}
                      aspectRatio={activeAspectRatio.aspectRatio}
                      emptyState="上传主图，或先从商品图片 URL 中抓取并选择候选图。"
                      accent={false}
                      onOpenImage={() => setIsComparisonOpen(true)}
                    />

                    <PreviewCard
                      key={result?.imageUrl || "result-empty"}
                      title="生成结果"
                      subtitle={result ? "AI 输出" : "等待生成"}
                      imageUrl={result?.imageUrl ?? ""}
                      aspectRatio={resultAspectRatio.aspectRatio}
                      emptyState="完成配置后点击「生成主图」，这里会展示最终结果。"
                      accent
                      onOpenImage={() => setIsComparisonOpen(true)}
                    />
                  </div>

                  {showSellingPointsPanel ? (
                    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)]">
                      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--panel-soft)] px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="text-[color:var(--accent)]">
                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-[11px] w-[11px]">
                              <path d="M12 2.5 13.9 8l5.6 1.9-5.6 1.9L12 17.5l-1.9-5.7L4.5 9.9 10.1 8 12 2.5Z" />
                            </svg>
                          </span>
                          <span className="text-[11.5px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
                            卖点文字识别
                          </span>
                          <span className="truncate text-[10.5px] text-[var(--ink3)]">
                            从图片中提炼 · {targetLanguage.trim() || "目标语言"} 覆层 + 中文对照
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopySellingPoints}
                          disabled={isAnalyzing || isSellingPointsEmptyState}
                          className="inline-flex shrink-0 items-center gap-1 rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-0.5 text-[10.5px] text-[var(--ink2)] transition hover:bg-[var(--panel-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <CopyIcon />
                          {copiedSellingPoints ? "已复制" : "复制全部"}
                        </button>
                      </div>
                      <div className="px-4 py-3">
                        {isAnalyzing ? (
                          <p className="py-3 text-center text-[11.5px] text-[var(--ink3)]">
                            正在识别图片中的卖点文字…
                          </p>
                        ) : sellingPointsFromResponse === null ? (
                          <p className="py-3 text-center text-[11.5px] text-[var(--ink3)]">
                            请勾选后重新生成图片以提炼卖点 / Regenerate with this option enabled to extract selling points
                          </p>
                        ) : isSellingPointsEmptyState ? (
                          <p className="py-3 text-center text-[11.5px] text-[var(--ink3)]">
                            {sellingPointsError ?? "未从图片中识别到明显卖点 / No prominent selling points detected"}
                          </p>
                        ) : (
                          sellingPointsFromResponse.map((item, index) => (
                            <div
                              key={`${item.target}-${index}`}
                              className={cx(
                                "grid grid-cols-[20px_1fr_1fr] items-baseline gap-3 py-1.5 hover:bg-[var(--panel-soft)]",
                                index < sellingPointsFromResponse.length - 1
                                  ? "border-b border-[var(--line-soft)]"
                                  : "",
                              )}
                            >
                              <span className="font-mono-code text-[10px] tabular-nums text-[var(--muted)]">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <div className="font-serif text-[13px] font-medium tracking-[-0.01em] text-[var(--ink)]">
                                {item.target}
                              </div>
                              <div className="text-[12px] leading-[1.45] text-[var(--ink2)]">
                                {item.zh}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* Result delivery */}
                  <div className="rounded-md border border-[var(--border)] bg-[var(--panel-soft)]">
                    {result?.usedFallback ? (
                      <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 rounded-t-md">
                        已自动回退：{requestedResultModelFamily.label} → {result.actualModelLabel}
                      </div>
                    ) : null}
                    <div className="px-3 py-2.5">
                      <p className={FIELD_LABEL_CLASS}>
                        {result?.deliveryKind === "local-data" || (!result && activeModelFamily.id === "gpt-image-1-5")
                          ? "生成结果（本地预览）"
                          : "生成图 URL"}
                      </p>
                      <div className="dashboard-url-bar mt-1.5 px-3 py-2 text-xs leading-5">
                        {result?.copyableImageUrl ||
                          (result?.deliveryKind === "local-data"
                            ? "当前模型返回本地预览数据，仅支持下载图片。"
                            : "生成完成后，这里会展示服务商返回的图片 URL。")}
                      </div>
                      {result?.revisedPrompt ? (
                        <div className="mt-2.5">
                          <p className={FIELD_LABEL_CLASS}>修订提示词</p>
                          <p className="mt-1 whitespace-pre-wrap text-[11px] leading-[1.6] text-[var(--ink2)]">
                            {result.revisedPrompt}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pb-1">
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={!canGenerate || isGenerating}
                      className="dashboard-secondary-button inline-flex items-center gap-1.5 px-3 py-[7px] text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <SwapIcon />
                      重新生成
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyResultUrl}
                      disabled={!result?.copyableImageUrl}
                      className="dashboard-secondary-button inline-flex items-center gap-1.5 px-3 py-[7px] text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CopyIcon />
                      {copied ? "已复制" : "复制 URL"}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadResultImage}
                      disabled={!result?.imageUrl}
                      className="dashboard-secondary-button inline-flex items-center gap-1.5 px-3 py-[7px] text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <DownloadIcon />
                      下载
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </section>
        </div>

      {isSettingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="关闭 API Key 设置"
            onClick={() => setIsSettingsOpen(false)}
          />
          <section className="dashboard-panel relative z-10 w-full max-w-lg rounded-lg p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={FIELD_LABEL_CLASS}>API Key 设置</p>
                <h2 className="mt-1 text-[17px] font-bold tracking-[-0.01em] text-[var(--ink)]">
                  管理本地预览所用的 API Key
                </h2>
                <p className="mt-1 text-[12.5px] leading-[1.6] text-[var(--ink3)]">
                  密钥只保存在当前浏览器本地，不写入服务器环境变量。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="dashboard-secondary-button inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                aria-label="关闭设置"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label className={FIELD_LABEL_CLASS}>API Key</label>
                  <button
                    type="button"
                    onClick={() => setApiKey("")}
                    className="text-[11px] font-medium text-[var(--ink3)] transition hover:text-[var(--ink)]"
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

              <div className="flex flex-col gap-2.5 sm:flex-row">
                <a
                  href="https://api.bltcy.ai/register?aff=kGaB90952"
                  target="_blank"
                  rel="noreferrer"
                  className="dashboard-dark-button inline-flex min-h-10 flex-1 items-center justify-center px-5 text-[13px] font-semibold no-underline"
                >
                  获取 API Key
                </a>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="dashboard-secondary-button inline-flex min-h-10 flex-1 items-center justify-center px-5 text-[13px] font-semibold"
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
          <section className="relative z-10 flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0f1217] shadow-[0_32px_100px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Compare Mode
                </p>
                <p className="mt-1 text-[17px] font-bold text-white">图片对比预览</p>
                <p className="truncate text-[12px] text-slate-400">
                  左侧查看原始主图，右侧查看生成结果，便于直接对比细节变化。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsComparisonOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                aria-label="关闭对比预览"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-[#0f1217] p-4 sm:p-5">
              <div className="grid min-w-[980px] gap-3 lg:grid-cols-2">
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
                  aspectRatio={resultAspectRatio.aspectRatio}
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

function PanelHeader({ title, step }: { title: string; step: string }) {
  return (
    <div className={PANEL_HEADER_CLASS}>
      <p className="text-[13px] font-semibold text-[var(--ink)]">{title}</p>
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink3)]">{step}</span>
    </div>
  );
}


const RETRY_DELAYS = [2000, 4000, 8000];

function PreviewCard({
  title,
  subtitle,
  imageUrl,
  aspectRatio,
  emptyState,
  accent = false,
  onOpenImage,
}: {
  title: string;
  subtitle: string;
  imageUrl: string;
  aspectRatio: string;
  emptyState: string;
  accent?: boolean;
  onOpenImage: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [useProxy, setUseProxy] = useState(false);
  const [failed, setFailed] = useState(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  function handleImgError() {
    if (attempt < RETRY_DELAYS.length) {
      setRetrying(true);
      retryTimerRef.current = setTimeout(() => {
        setAttempt((n) => n + 1);
        setRetrying(false);
      }, RETRY_DELAYS[attempt]);
    } else if (!useProxy) {
      setUseProxy(true);
    } else {
      setFailed(true);
    }
  }

  return (
    <article
      className={cx(
        "overflow-hidden rounded-md border bg-[var(--panel)]",
        accent ? "border-[color:var(--accent-soft)]" : "border-[var(--border)]",
      )}
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <div>
          <p className="text-[12px] font-semibold text-[var(--ink)]">{title}</p>
          <p className="text-[10.5px] text-[var(--ink3)]">{subtitle}</p>
        </div>
        {accent && imageUrl ? (
          <span className="rounded border border-[color:var(--accent-soft)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[color:var(--accent-strong)]">
            已生成
          </span>
        ) : null}
      </div>

      <div className={cx(accent ? "dashboard-preview-surface-accent" : "dashboard-preview-surface")} style={{ aspectRatio }}>
        {imageUrl ? (
          failed ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
              <p className="text-xs text-[var(--ink3)]">图片加载失败</p>
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold text-[color:var(--accent)] transition hover:opacity-80"
              >
                在新标签页打开
              </a>
            </div>
          ) : retrying ? (
            <div className="flex h-full items-center justify-center p-4 text-center">
              <p className="text-[11px] text-[var(--muted)]">图片加载中，第 {attempt + 1} 次重试…</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenImage}
              className="group relative block h-full w-full cursor-zoom-in p-3"
              aria-label={`放大预览${title}`}
            >
              <img
                key={`${attempt}-${useProxy}`}
                src={useProxy ? buildProxyImageUrl(imageUrl) : imageUrl}
                alt={title}
                onError={handleImgError}
                className="h-full w-full rounded-sm object-contain"
              />
              <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded border border-[var(--border)] bg-[var(--panel)]/90 px-2.5 py-1.5 text-[11px] text-[var(--ink2)] opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
                <span className="font-medium text-[var(--ink)]">{title}</span>
                <span>点击放大对比</span>
              </div>
            </button>
          )
        ) : (
          <div className="flex h-full items-center justify-center p-5 text-center text-[12px] leading-[1.6] text-[var(--ink3)]">
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
    <article className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <div className="border-b border-white/10 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{subtitle}</p>
        <p className="mt-0.5 text-[15px] font-bold text-white">{title}</p>
      </div>
      <div
        className="flex items-center justify-center bg-white/[0.03] p-4"
        style={{ aspectRatio }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="max-h-full w-auto max-w-full rounded object-contain shadow-[0_18px_60px_rgba(0,0,0,0.35)]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-center text-[12px] leading-[1.6] text-slate-400">
            {emptyState}
          </div>
        )}
      </div>
    </article>
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


function SpinnerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4 animate-spin">
      <path strokeLinecap="round" d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

function SwapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h14l-3-3m3 3-3 3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 17H7l3-3m-3 3 3 3" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 4H6a2 2 0 0 0-2 2v10" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0 4-4m-4 4-4-4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 18v2h16v-2" />
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
