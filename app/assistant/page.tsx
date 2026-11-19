"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Bot,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  HelpCircle,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Trash2,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import ModelSelector from "../components/ai/ModelSelector";
import {
  getStoredToken,
  getStoredUser,
  isPrivilegedUser,
  type AuthUser,
} from "../lib/api";
import { useI18n } from "../lib/app-i18n";
import { AiModel } from "@/src/server/ai/types";
import { AI_MODELS, DEFAULT_MODEL_ID } from "@/src/server/ai/registry";

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

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  // Load user, models, preferences, and saved conversation
  useEffect(() => {
    // Restore local state after mount so server rendering stays deterministic.
    const frame = requestAnimationFrame(() => {
      setUser(getStoredUser());
      try {
        const savedChat = localStorage.getItem(STORAGE_CHAT_KEY);
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

  // Save messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(messages));
    } else {
      localStorage.removeItem(STORAGE_CHAT_KEY);
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

  // Send Message
  const handleSend = async (customPrompt?: string) => {
    const promptToSend = (customPrompt || input).trim();
    if (!promptToSend || isGenerating) return;

    if (!customPrompt) setInput("");

    const userMessage: MessageItem = {
      id: "msg-" + Date.now() + "-user",
      role: "user",
      content: promptToSend,
      timestamp: new Date().toLocaleTimeString(locale === "ar" ? "ar-EG" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

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

    try {
      // Build API messages payload
      const apiMessages = nextMessages
        .slice(0, -1) // omit the placeholder
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
      let totalUsageTokens: number | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

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
        // User stopped generation manually
      } else {
        const errorMessage = err instanceof Error ? err.message : String(err);
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
      localStorage.removeItem(STORAGE_CHAT_KEY);
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
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--mute)" }}>
                {t("ai.subtitle")}
              </p>
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
                          padding: "12px 16px",
                          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                          background: isUser ? "var(--pri)" : "color-mix(in srgb, var(--card) 95%, var(--bg))",
                          color: isUser ? "#ffffff" : "var(--ink)",
                          border: isUser ? "none" : "1px solid var(--line)",
                          fontSize: "0.92rem",
                          lineHeight: 1.7,
                          wordBreak: "break-word",
                          whiteSpace: "pre-wrap",
                          boxShadow: "var(--shadow-sm)",
                        }}
                      >
                        {m.content ? (
                          m.content
                        ) : isGenerating && !isUser ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--mute)" }}>
                            <span className="animate-spin inline-block">
                              <RefreshCw size={14} />
                            </span>
                            <span style={{ fontSize: "0.82rem" }}>جارٍ التفكير وتوليد الإجابة...</span>
                          </div>
                        ) : null}
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
                  maxHeight: "140px",
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
                    disabled={!input.trim()}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: input.trim() ? "var(--pri)" : "color-mix(in srgb, var(--ink) 10%, transparent)",
                      color: input.trim() ? "#ffffff" : "var(--mute)",
                      border: "none",
                      cursor: input.trim() ? "pointer" : "default",
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
