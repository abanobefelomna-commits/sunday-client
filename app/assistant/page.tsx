"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  BookOpen,
  Bot,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  Paperclip,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  TrendingUp,
  User,
  X,
  Zap,
} from "lucide-react";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import ModelSelector from "../components/ai/ModelSelector";
import MarkdownMessage from "../components/ai/MarkdownMessage";
import {
  getStoredToken,
  getStoredUser,
  isPrivilegedUser,
  type AuthUser,
} from "../lib/api";
import { useI18n } from "../lib/app-i18n";
import { AiModel } from "@/src/server/ai/types";
import { AI_MODELS, DEFAULT_MODEL_ID } from "@/src/server/ai/registry";
import {
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
} from "@/src/server/ai/attachment-constants";

/** Grow the composer up to this height, then scroll inside it. */
const COMPOSER_MAX_HEIGHT = 160;
const COMPOSER_MIN_HEIGHT = 26;
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface MessageAttachment {
  name: string;
  mimeType: string;
  size: number;
}

interface MessageItem {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  reasoningContent?: string;
  timestamp: string;
  modelId?: string;
  modelName?: string;
  durationMs?: number;
  tokens?: number;
  attachments?: MessageAttachment[];
}

interface PendingAttachment extends MessageAttachment {
  id: string;
  kind: "image" | "pdf" | "text";
  data: string;
  previewUrl?: string;
}

function attachmentKind(mimeType: string): PendingAttachment["kind"] | null {
  if (["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"].includes(mimeType)) {
    return "image";
  }
  if (mimeType === "application/pdf") return "pdf";
  if (
    ["text/plain", "text/markdown", "text/x-markdown", "text/csv", "application/json"].includes(
      mimeType,
    )
  ) {
    return "text";
  }
  return null;
}

function readAsBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.replace(/^data:[^;,]*;base64,/, ""));
    };
    reader.onerror = () => reject(reader.error || new Error("تعذر قراءة الملف"));
    reader.readAsDataURL(file);
  });
}

async function prepareImage(file: File): Promise<{ data: string; mimeType: string; size: number; name: string }> {
  // Compress large phone photos so the request stays below the platform limit.
  if (file.size <= 1.4 * 1024 * 1024 || typeof createImageBitmap !== "function") {
    return { data: await readAsBase64(file), mimeType: file.type, size: file.size, name: file.name };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) throw new Error("Compression failed");
    return {
      data: await readAsBase64(blob),
      mimeType: "image/jpeg",
      size: blob.size,
      name: file.name.replace(/\.[^.]+$/, "") + ".jpg",
    };
  } catch {
    return { data: await readAsBase64(file), mimeType: file.type, size: file.size, name: file.name };
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
}

function normalizeFileType(file: File): string {
  if (file.type) return file.type.toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const fallback: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    json: "application/json",
  };
  return fallback[extension] || "";
}

const STORAGE_CHAT_KEY = "ss_ai_assistant_chat";
const STORAGE_MODEL_KEY = "ss_ai_model";

export default function AssistantPage() {
  const { t, locale } = useI18n();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [models, setModels] = useState<AiModel[]>(AI_MODELS);
  const [selectedModel, setSelectedModel] = useState<AiModel>(
    AI_MODELS.find((m) => m.id === DEFAULT_MODEL_ID) || AI_MODELS[0],
  );
  const [defaultModelId, setDefaultModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [switchBanner, setSwitchBanner] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());

  // ChatGPT-style auto-growing composer: reset height, measure the wrapped
  // content, then clamp it so long messages scroll inside the field.
  const resizeComposer = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.overflowY = "hidden";
    const nextHeight = Math.min(
      Math.max(textarea.scrollHeight, COMPOSER_MIN_HEIGHT),
      COMPOSER_MAX_HEIGHT,
    );
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > COMPOSER_MAX_HEIGHT ? "auto" : "hidden";
  }, []);

  useIsomorphicLayoutEffect(() => {
    resizeComposer();
  }, [input, resizeComposer]);

  useEffect(() => {
    window.addEventListener("resize", resizeComposer);
    return () => window.removeEventListener("resize", resizeComposer);
  }, [resizeComposer]);

  // Release object URLs created for image previews.
  useEffect(
    () => () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
    },
    [],
  );

  // Auto-scroll to the newest message. Skip while the conversation is empty so
  // the page does not jump on first load and hide the header/model selector
  // underneath the sticky app bar.
  useEffect(() => {
    if (messages.length === 0) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isGenerating]);

  // Load user, models, preferences, and saved conversation
  useEffect(() => {
    // Restore local state after mount so server rendering stays deterministic.
    const frame = requestAnimationFrame(() => {
      setUser(getStoredUser());
      try {
        const savedChat = sessionStorage.getItem(STORAGE_CHAT_KEY);
        if (savedChat) {
          const parsed = JSON.parse(savedChat);
          if (Array.isArray(parsed)) setMessages(parsed);
        }
      } catch {
        // Ignore malformed saved conversations.
      }
    });

    // Fetch models and default from API
    fetch("/api/ai/models", {
      headers: { Authorization: `Bearer ${getStoredToken() || ""}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.models) {
          setModels(data.models);
          if (data.defaultModelId) {
            setDefaultModelId(data.defaultModelId);
          }

          // Check if user had a locally stored model
          const savedModelId = localStorage.getItem(STORAGE_MODEL_KEY);
          const found = data.models.find(
            (m: AiModel) => m.id === (savedModelId || data.defaultModelId),
          );
          if (found && found.status === "live") {
            setSelectedModel(found);
          }
        }
      })
      .catch(() => {
        // Fall back to built-in registry
      });

    return () => cancelAnimationFrame(frame);
  }, []);

  // Chat may contain children's names, so keep it for this tab session only.
  // Save messages to sessionStorage
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(messages));
    } else {
      sessionStorage.removeItem(STORAGE_CHAT_KEY);
    }
  }, [messages]);

  // Switch Model Handler
  const handleSelectModel = (newModel: AiModel) => {
    if (newModel.id === selectedModel.id) return;
    setSelectedModel(newModel);
    localStorage.setItem(STORAGE_MODEL_KEY, newModel.id);

    // Show model switch banner
    setSwitchBanner(
      t("ai.modelSwitched", {
        name: newModel.name,
        provider: newModel.providerName,
      }),
    );
    window.setTimeout(() => setSwitchBanner(null), 4000);
  };

  // Set Church Default Handler
  const handleSetDefault = async (modelId: string) => {
    const res = await fetch("/api/ai/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getStoredToken() || ""}`,
      },
      body: JSON.stringify({ modelId }),
    });
    if (res.ok) {
      setDefaultModelId(modelId);
    }
  };

  // Pick, validate, and encode attachments
  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachmentError(null);

    const incoming = Array.from(files);
    if (pendingAttachments.length + incoming.length > MAX_ATTACHMENTS) {
      setAttachmentError(`الحد الأقصى ${MAX_ATTACHMENTS} مرفقات في الرسالة الواحدة.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    let totalBytes = pendingAttachments.reduce((sum, item) => sum + item.size, 0);
    const accepted: PendingAttachment[] = [];

    for (const file of incoming) {
      const mimeType = normalizeFileType(file);
      const kind = attachmentKind(mimeType);
      if (!kind) {
        setAttachmentError(
          "نوع الملف غير مدعوم. المسموح: صور PNG/JPG/WEBP/GIF، ملفات PDF، وملفات نصية.",
        );
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setAttachmentError(`حجم الملف "${file.name}" أكبر من 2.5 ميجابايت.`);
        continue;
      }

      try {
        const prepared =
          kind === "image"
            ? await prepareImage(file)
            : {
                data: await readAsBase64(file),
                mimeType,
                size: file.size,
                name: file.name,
              };

        if (prepared.size > MAX_ATTACHMENT_BYTES) {
          setAttachmentError(`حجم الملف "${file.name}" أكبر من 2.5 ميجابايت بعد الضغط.`);
          continue;
        }
        if (totalBytes + prepared.size > 3 * 1024 * 1024) {
          setAttachmentError("إجمالي حجم المرفقات أكبر من 3 ميجابايت.");
          break;
        }

        totalBytes += prepared.size;
        const previewUrl = kind === "image" ? URL.createObjectURL(file) : undefined;
        if (previewUrl) previewUrlsRef.current.add(previewUrl);

        accepted.push({
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `att-${Date.now()}-${accepted.length}`,
          name: prepared.name,
          mimeType: prepared.mimeType,
          size: prepared.size,
          kind,
          data: prepared.data,
          previewUrl,
        });
      } catch {
        setAttachmentError(`تعذر قراءة الملف "${file.name}".`);
      }
    }

    if (accepted.length > 0) {
      setPendingAttachments((prev) => [...prev, ...accepted]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingAttachment = (id: string) => {
    setPendingAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
        previewUrlsRef.current.delete(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  // Send Message
  const handleSend = async (customPrompt?: string) => {
    const promptToSend = (customPrompt || input).trim();
    if ((!promptToSend && pendingAttachments.length === 0) || isGenerating) return;

    if (
      pendingAttachments.some((item) => item.kind === "image") &&
      !selectedModel.capabilities.supportsVision
    ) {
      setAttachmentError(
        "النموذج الحالي لا يدعم تحليل الصور. اختر نموذجًا يدعم الرؤية مثل Gemini أو GPT-6 أو Claude Opus.",
      );
      return;
    }
    if (
      pendingAttachments.some((item) => item.kind === "pdf") &&
      !selectedModel.capabilities.supportsFiles
    ) {
      setAttachmentError("النموذج الحالي لا يدعم قراءة PDF مباشرة. اختر نموذجًا آخر.");
      return;
    }

    setAttachmentError(null);
    const effectivePrompt =
      promptToSend || "حلّل الملفات المرفقة وأعطني ملخصًا مفيدًا وخطوات عملية للاستفادة منها في الخدمة.";
    const attachmentsToSend = pendingAttachments;

    if (!customPrompt) setInput("");

    const userMessage: MessageItem = {
      id: "msg-" + Date.now() + "-user",
      role: "user",
      content: effectivePrompt,
      timestamp: new Date().toLocaleTimeString(locale === "ar" ? "ar-EG" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      attachments: attachmentsToSend.map(({ name, mimeType, size }) => ({
        name,
        mimeType,
        size,
      })),
    };

    // Attachments belong to the sent message only; never keep base64 in
    // localStorage or resend it with later turns.
    setPendingAttachments([]);
    attachmentsToSend.forEach((item) => {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
        previewUrlsRef.current.delete(item.previewUrl);
      }
    });

    const assistantPlaceholderId = "msg-" + (Date.now() + 1) + "-assistant";
    const initialAssistantMessage: MessageItem = {
      id: assistantPlaceholderId,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString(locale === "ar" ? "ar-EG" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      modelId: selectedModel.id,
      modelName: selectedModel.name,
    };

    const nextMessages = [...messages, userMessage, initialAssistantMessage];
    setMessages(nextMessages);
    setIsGenerating(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const startTime = Date.now();
    // Abort the request when the provider stops sending data so a stalled
    // stream (for example a provider 503 that never closes) cannot leave the
    // composer and model selector disabled indefinitely.
    let watchdog: number | undefined;
    let timedOut = false;
    const STREAM_IDLE_TIMEOUT_MS = 60_000;
    const armWatchdog = () => {
      if (watchdog !== undefined) window.clearTimeout(watchdog);
      watchdog = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, STREAM_IDLE_TIMEOUT_MS);
    };

    try {
      // Arm before the request: a stalled provider can prevent the response
      // headers from ever arriving, so arming after `fetch` is too late.
      armWatchdog();

      // Build API messages payload. Keep only the most recent turns so the
      // request stays well below the server-side history limit.
      const apiMessages = nextMessages
        .slice(0, -1) // omit the placeholder
        .slice(-30)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getStoredToken() || ""}`,
        },
        body: JSON.stringify({
          modelId: selectedModel.id,
          messages: apiMessages,
          stream: true,
          attachments: attachmentsToSend.map((item) => ({
            name: item.name,
            mimeType: item.mimeType,
            data: item.data,
          })),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let errText = t("ai.errorOccurred");
        try {
          const errJson = await res.json();
          if (errJson?.message) errText = errJson.message;
        } catch {
          // ignore
        }
        throw new Error(errText);
      }

      if (!res.body) {
        throw new Error("No response stream received.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let streamedContent = "";
      let streamedReasoning = "";
      armWatchdog();
      let totalUsageTokens: number | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        armWatchdog();

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const dataStr = trimmed.slice(6);
          if (dataStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.error) {
              throw new Error(parsed.error);
            }

            if (parsed.contentDelta) {
              streamedContent += parsed.contentDelta;
            }
            if (parsed.reasoningDelta) {
              streamedReasoning += parsed.reasoningDelta;
            }
            if (parsed.usage?.totalTokens) {
              totalUsageTokens = parsed.usage.totalTokens;
            }

            // Update placeholder
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantPlaceholderId
                  ? {
                      ...msg,
                      content: streamedContent,
                      reasoningContent: streamedReasoning || undefined,
                      durationMs: Date.now() - startTime,
                      tokens: totalUsageTokens,
                    }
                  : msg,
              ),
            );
          } catch (e: unknown) {
            if (
              e instanceof Error &&
              e.message &&
              e.message !== "Unexpected end of JSON input"
            ) {
              // propagate meaningful errors
              throw e;
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        if (timedOut) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantPlaceholderId
                ? {
                    ...msg,
                    content: `⚠️ **${t("ai.errorOccurred")}**: The AI provider stopped responding. Please try again.`,
                    durationMs: Date.now() - startTime,
                  }
                : msg,
            ),
          );
        }
        // Otherwise the user stopped generation manually.
      } else {
        const rawMessage = err instanceof Error ? err.message : String(err);
        const errorMessage =
          rawMessage === "Failed to fetch"
            ? "The connection to the AI service was interrupted. Please try again."
            : rawMessage;
        const errorContent = `⚠️ **${t("ai.errorOccurred")}**: ${errorMessage}`;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantPlaceholderId
              ? {
                  ...msg,
                  content: errorContent,
                  durationMs: Date.now() - startTime,
                }
              : msg,
          ),
        );
      }
    } finally {
      if (watchdog !== undefined) window.clearTimeout(watchdog);
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // Stop Generation
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  };

  // Clear conversation
  const handleClear = () => {
    if (messages.length === 0) return;
    if (window.confirm(t("ai.clearConfirm"))) {
      setMessages([]);
      sessionStorage.removeItem(STORAGE_CHAT_KEY);
    }
  };

  // Copy message
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  // Toggle reasoning view
  const toggleReasoning = (id: string) => {
    setExpandedReasoning((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isPrivileged = isPrivilegedUser(user);

  return (
    <div className="in-app min-h-screen pb-24 md:pb-8 flex flex-col">
      <AppHeader />

      <main className="flex-1 flex flex-col max-w-5xl w-full mx-auto px-3 sm:px-6 pt-4">
        {/* Top Bar with Title and Model Selector */}
        <div
          className="assistant-header-card"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "14px 18px",
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-lg)",
            boxShadow: "var(--shadow-sm)",
            marginBottom: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "40px",
                height: "40px",
                borderRadius: "var(--r-md)",
                background: "radial-gradient(circle, var(--pri), var(--pri-hover))",
                color: "#ffffff",
                boxShadow: "0 4px 12px color-mix(in srgb, var(--pri) 30%, transparent)",
              }}
            >
              <Bot size={22} />
            </span>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "1.2rem",
                  fontWeight: 800,
                  color: "var(--ink)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {t("ai.title")}
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "10px",
                    background: "var(--ok-soft)",
                    color: "var(--ok)",
                  }}
                >
                  PRO
                </span>
              </h1>
              <div
                style={{
                  margin: 0,
                  fontSize: "0.8rem",
                  color: "var(--mute)",
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <span>{t("ai.subtitle")}</span>
                {user && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "10px",
                      background: isPrivileged
                        ? "color-mix(in srgb, var(--ok) 12%, transparent)"
                        : "color-mix(in srgb, var(--pri) 10%, transparent)",
                      color: isPrivileged ? "var(--ok)" : "var(--pri)",
                    }}
                  >
                    <ShieldCheck size={12} />
                    {isPrivileged ? "وصول كامل لكل الفصول" : "بيانات فصلك فقط"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Model Selector & Chat Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <ModelSelector
              models={models}
              selectedModel={selectedModel}
              onSelectModel={handleSelectModel}
              disabled={isGenerating}
              isChurchAdmin={isPrivileged}
              onSetDefault={handleSetDefault}
              defaultModelId={defaultModelId}
            />

            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                disabled={isGenerating}
                title={t("ai.clearChat")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "36px",
                  height: "36px",
                  borderRadius: "var(--r-md)",
                  background: "color-mix(in srgb, var(--ink) 5%, transparent)",
                  color: "var(--mute)",
                  border: "1px solid var(--line)",
                  cursor: isGenerating ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Model Switch Toast / Banner */}
        {switchBanner && (
          <div
            className="animate-fade-in"
            style={{
              padding: "8px 16px",
              marginBottom: "12px",
              background: "color-mix(in srgb, var(--pri) 12%, var(--card))",
              border: "1px solid var(--pri)",
              borderRadius: "var(--r-md)",
              color: "var(--ink)",
              fontSize: "0.85rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Sparkles size={16} style={{ color: "var(--pri)", flexShrink: 0 }} />
            <span>{switchBanner}</span>
          </div>
        )}

        {/* Chat Area Container */}
        <div
          className="chat-main-container flex-1 flex flex-col"
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-xl)",
            boxShadow: "var(--shadow-sm)",
            overflow: "hidden",
            minHeight: "450px",
          }}
        >
          {/* Messages Scroll Area */}
          <div
            className="messages-scroll-area flex-1"
            style={{
              padding: "20px 16px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {messages.length === 0 ? (
              /* Empty state with suggested prompts */
              <div
                style={{
                  margin: "auto",
                  maxWidth: "580px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "16px",
                  padding: "40px 16px",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "60px",
                    height: "60px",
                    borderRadius: "50%",
                    background: "color-mix(in srgb, var(--pri) 12%, transparent)",
                    color: "var(--pri)",
                  }}
                >
                  <Sparkles size={30} />
                </span>

                <div>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 6px 0", color: "var(--ink)" }}>
                    {t("ai.emptyTitle")}
                  </h2>
                  <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--mute)", lineHeight: 1.6 }}>
                    {t("ai.emptyDesc")}
                  </p>
                </div>

                {/* Quick Prompts Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: "10px",
                    width: "100%",
                    marginTop: "8px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      handleSend(
                        "حضّر لي درس مدارس أحد كامل عن (مثل السامري الصالح) لسن رابعة وخامسة ابتدائي. يشمل: الهدف الروحي، الآية الذهبية بالشاهد، مقدمة مشوقة، عناصر الدرس بأسلوب سردي ممتع، وسائل إيضاح عملية، وتطبيق حياتي للطفل.",
                      )
                    }
                    className="quick-prompt-card"
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "12px 14px",
                      background: "color-mix(in srgb, var(--ink) 3%, transparent)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--r-md)",
                      textAlign: "inherit",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <BookOpen size={18} style={{ color: "var(--pri)", flexShrink: 0, marginTop: "2px" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <strong style={{ fontSize: "0.85rem", color: "var(--ink)" }}>{t("ai.quickPrep")}</strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--mute)" }}>
                        مثل السامري الصالح لسن ابتدائي
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleSend(
                        "ولّد لي 15 سؤال مسابقات دينية تعليمية شيقة ومتدرجة الصعوبة للأطفال في مدارس الأحد، مع الإجابة النموذجية والشاهد الكتابي لكل سؤال.",
                      )
                    }
                    className="quick-prompt-card"
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "12px 14px",
                      background: "color-mix(in srgb, var(--ink) 3%, transparent)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--r-md)",
                      textAlign: "inherit",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <HelpCircle size={18} style={{ color: "#d97706", flexShrink: 0, marginTop: "2px" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <strong style={{ fontSize: "0.85rem", color: "var(--ink)" }}>{t("ai.quickQuestions")}</strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--mute)" }}>
                        15 سؤال متنوع مع الشواهد الكتابية
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleSend(
                        "لدينا فصل به 25 طفلاً، في الأسابيع الأربعة الماضية تغيب 6 أطفال لأكثر من 3 مرات متتالية. حلل أسباب الغياب المحتملة واقترح خطة افتقاد ورعاية تفصيلية للخادم لمتابعتهم واستعادتهم بحب.",
                      )
                    }
                    className="quick-prompt-card"
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "12px 14px",
                      background: "color-mix(in srgb, var(--ink) 3%, transparent)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--r-md)",
                      textAlign: "inherit",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <TrendingUp size={18} style={{ color: "#059669", flexShrink: 0, marginTop: "2px" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <strong style={{ fontSize: "0.85rem", color: "var(--ink)" }}>{t("ai.quickAnalysis")}</strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--mute)" }}>
                        تحليل تقرير الغياب وخطة افتقاد
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleSend(
                        "اقترح 3 ألعاب تفاعلية مبتكرة لكسر الجليد في بداية درس مدارس الأحد تعزز التعاون والمحبة بين الأطفال دون الحاجة لأدوات معقدة.",
                      )
                    }
                    className="quick-prompt-card"
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "12px 14px",
                      background: "color-mix(in srgb, var(--ink) 3%, transparent)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--r-md)",
                      textAlign: "inherit",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Zap size={18} style={{ color: "#db2777", flexShrink: 0, marginTop: "2px" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <strong style={{ fontSize: "0.85rem", color: "var(--ink)" }}>{t("ai.quickIcebreaker")}</strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--mute)" }}>
                        ألعاب وأنشطة تفاعلية للدرس
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              /* Message List */
              messages.map((m) => {
                const isUser = m.role === "user";
                const isReasoningOpen = expandedReasoning[m.id] ?? false;

                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      gap: "12px",
                      alignSelf: isUser ? "flex-end" : "flex-start",
                      maxWidth: isUser ? "85%" : "95%",
                      flexDirection: isUser ? (locale === "ar" ? "row" : "row-reverse") : (locale === "ar" ? "row-reverse" : "row"),
                    }}
                  >
                    {/* Message Bubble Body */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                      {/* Model & Meta Header for Assistant */}
                      {!isUser && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "0.74rem",
                            color: "var(--mute)",
                            marginBottom: "2px",
                          }}
                        >
                          <span style={{ fontWeight: 700, color: "var(--pri)" }}>
                            {m.modelName || selectedModel.name}
                          </span>
                          <span>•</span>
                          <span>{m.timestamp}</span>
                          {m.durationMs && (
                            <>
                              <span>•</span>
                              <span>{(m.durationMs / 1000).toFixed(1)} ث</span>
                            </>
                          )}
                          {m.tokens && (
                            <>
                              <span>•</span>
                              <span>{m.tokens} توكن</span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Reasoning Box (if available for reasoning models like gpt-oss-20b/120b) */}
                      {!isUser && m.reasoningContent && (
                        <div
                          style={{
                            marginBottom: "6px",
                            borderRadius: "var(--r-md)",
                            background: "color-mix(in srgb, var(--violet) 8%, var(--card))",
                            border: "1px solid color-mix(in srgb, var(--violet) 25%, transparent)",
                            overflow: "hidden",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => toggleReasoning(m.id)}
                            style={{
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "6px 12px",
                              background: "none",
                              border: "none",
                              color: "var(--violet)",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <BrainCircuit size={14} />
                              {t("ai.reasoning")}
                            </span>
                            {isReasoningOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>

                          {isReasoningOpen && (
                            <div
                              style={{
                                padding: "8px 12px",
                                borderTop: "1px dashed color-mix(in srgb, var(--violet) 20%, transparent)",
                                fontSize: "0.76rem",
                                color: "var(--mute)",
                                whiteSpace: "pre-wrap",
                                lineHeight: 1.5,
                                maxHeight: "200px",
                                overflowY: "auto",
                                fontFamily: "monospace",
                              }}
                            >
                              {m.reasoningContent}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Message Content */}
                      <div
                        style={{
                          padding: isUser ? "12px 16px" : "14px 17px",
                          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                          background: isUser ? "var(--pri)" : "color-mix(in srgb, var(--card) 95%, var(--bg))",
                          color: isUser ? "#ffffff" : "var(--ink)",
                          border: isUser ? "none" : "1px solid var(--line)",
                          fontSize: "0.92rem",
                          lineHeight: 1.7,
                          wordBreak: "break-word",
                          boxShadow: "var(--shadow-sm)",
                        }}
                      >
                        {m.content ? (
                          isUser ? (
                            <span style={{ whiteSpace: "pre-wrap" }}>{m.content}</span>
                          ) : (
                            <MarkdownMessage
                              content={m.content}
                              streaming={isGenerating && m === messages[messages.length - 1]}
                              onChoose={
                                !isGenerating && m === messages[messages.length - 1]
                                  ? (choice) => handleSend(choice)
                                  : undefined
                              }
                            />
                          )
                        ) : isGenerating && !isUser ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--mute)" }}>
                            <span className="animate-spin inline-block">
                              <RefreshCw size={14} />
                            </span>
                            <span style={{ fontSize: "0.82rem" }}>جارٍ التفكير وتوليد الإجابة...</span>
                          </div>
                        ) : null}

                        {isUser && m.attachments && m.attachments.length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "6px",
                              marginTop: m.content ? "10px" : 0,
                            }}
                          >
                            {m.attachments.map((attachment, index) => (
                              <span
                                key={`${attachment.name}-${index}`}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  padding: "4px 8px",
                                  borderRadius: "8px",
                                  background: "rgba(255, 255, 255, 0.17)",
                                  fontSize: "0.72rem",
                                }}
                              >
                                {attachment.mimeType.startsWith("image/") ? (
                                  <ImageIcon size={13} />
                                ) : (
                                  <FileText size={13} />
                                )}
                                <span
                                  style={{
                                    maxWidth: "180px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {attachment.name}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Message Footer / Copy */}
                      {!isUser && m.content && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginTop: "4px",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleCopy(m.id, m.content)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "2px 8px",
                              background: "none",
                              border: "none",
                              color: "var(--mute)",
                              fontSize: "0.72rem",
                              cursor: "pointer",
                            }}
                          >
                            {copiedId === m.id ? (
                              <>
                                <Check size={12} style={{ color: "var(--ok)" }} />
                                <span style={{ color: "var(--ok)" }}>{t("ai.copied")}</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>{t("ai.copy")}</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Avatar */}
                    <div
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        background: isUser
                          ? "color-mix(in srgb, var(--pri) 20%, transparent)"
                          : "radial-gradient(circle, var(--pri), var(--pri-hover))",
                        color: isUser ? "var(--pri)" : "#ffffff",
                        marginTop: "2px",
                      }}
                    >
                      {isUser ? <User size={18} /> : <Bot size={18} />}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Input Area */}
          <div
            style={{
              padding: "12px 16px",
              borderTop: "1px solid var(--line)",
              background: "color-mix(in srgb, var(--card) 98%, var(--bg))",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {/* Pending attachments preview */}
            {pendingAttachments.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  padding: "2px 2px 0",
                }}
              >
                {pendingAttachments.map((attachment) => (
                  <div key={attachment.id} className="ai-attachment-chip">
                    {attachment.kind === "image" && attachment.previewUrl ? (
                      <img
                        src={attachment.previewUrl}
                        alt={attachment.name}
                        className="ai-attachment-thumb"
                      />
                    ) : (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "42px",
                          height: "42px",
                          borderRadius: "8px",
                          background: "color-mix(in srgb, var(--pri) 10%, transparent)",
                          color: "var(--pri)",
                          flexShrink: 0,
                        }}
                      >
                        {attachment.kind === "pdf" ? <FileText size={18} /> : <BookOpen size={18} />}
                      </span>
                    )}
                    <span
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "1px",
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          maxWidth: "170px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontWeight: 600,
                        }}
                      >
                        {attachment.name}
                      </span>
                      <span style={{ fontSize: "0.7rem", color: "var(--mute)" }}>
                        {formatFileSize(attachment.size)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removePendingAttachment(attachment.id)}
                      title="إزالة المرفق"
                      aria-label={`إزالة المرفق ${attachment.name}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        border: "none",
                        background: "color-mix(in srgb, var(--danger) 12%, transparent)",
                        color: "var(--danger)",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {attachmentError && (
              <div
                role="alert"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "8px",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  background: "color-mix(in srgb, var(--danger) 9%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--danger) 25%, transparent)",
                  color: "var(--danger)",
                  fontSize: "0.78rem",
                  lineHeight: 1.5,
                }}
              >
                <span>{attachmentError}</span>
                <button
                  type="button"
                  onClick={() => setAttachmentError(null)}
                  aria-label="إغلاق التنبيه"
                  style={{
                    background: "none",
                    border: "none",
                    color: "inherit",
                    cursor: "pointer",
                    padding: 0,
                    display: "inline-flex",
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,text/csv,application/json"
              onChange={(e) => {
                void handleFilesSelected(e.target.files);
              }}
              style={{ display: "none" }}
            />

            {/* Input pill with active model indicator */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "8px",
                background: "var(--card)",
                border: "1.5px solid var(--line)",
                borderRadius: "var(--r-lg)",
                padding: "8px 12px",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isGenerating}
                title="إرفاق صورة أو ملف PDF أو ملف نصي"
                aria-label="إرفاق ملف"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "34px",
                  height: "34px",
                  flexShrink: 0,
                  borderRadius: "50%",
                  border: "none",
                  background:
                    pendingAttachments.length > 0
                      ? "color-mix(in srgb, var(--pri) 12%, transparent)"
                      : "transparent",
                  color: pendingAttachments.length > 0 ? "var(--pri)" : "var(--mute)",
                  cursor: isGenerating ? "default" : "pointer",
                  opacity: isGenerating ? 0.55 : 1,
                }}
              >
                <Paperclip size={17} />
              </button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={t("ai.inputPlaceholder")}
                rows={1}
                disabled={isGenerating}
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: "var(--ink)",
                  fontSize: "0.92rem",
                  lineHeight: 1.5,
                  resize: "none",
                  minHeight: `${COMPOSER_MIN_HEIGHT}px`,
                  maxHeight: `${COMPOSER_MAX_HEIGHT}px`,
                  overflowY: "hidden",
                  fontFamily: "inherit",
                }}
              />

              {/* Action Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {/* Active Model Indicator Tag */}
                <span
                  title={`${t("ai.currentModel")}: ${selectedModel.name}`}
                  style={{
                    fontSize: "0.72rem",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    background: "color-mix(in srgb, var(--ink) 6%, transparent)",
                    color: "var(--mute)",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    display: "none", // visible on larger screens
                  }}
                  className="sm:inline-flex items-center gap-1"
                >
                  <Bot size={12} />
                  <span>{selectedModel.name}</span>
                </span>

                {isGenerating ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "var(--danger)",
                      color: "#ffffff",
                      border: "none",
                      cursor: "pointer",
                      transition: "transform 0.15s ease",
                    }}
                    title={t("ai.stop")}
                  >
                    <Square size={14} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim() && pendingAttachments.length === 0}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background:
                        input.trim() || pendingAttachments.length > 0
                          ? "var(--pri)"
                          : "color-mix(in srgb, var(--ink) 10%, transparent)",
                      color:
                        input.trim() || pendingAttachments.length > 0
                          ? "#ffffff"
                          : "var(--mute)",
                      border: "none",
                      cursor:
                        input.trim() || pendingAttachments.length > 0 ? "pointer" : "default",
                      transition: "all 0.15s ease",
                    }}
                    title={t("ai.send")}
                  >
                    <Send
                      size={16}
                      style={{
                        transform: locale === "ar" ? "rotate(180deg)" : "none",
                      }}
                    />
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
