"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Cpu,
  Flame,
  Info,
  Layers,
  PenTool,
  Search,
  Sparkles,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import { AiModel, ModelCategory } from "@/src/server/ai/types";
import { useI18n, type AppMessageKey } from "../../lib/app-i18n";

function getCategoryLabel(t: (k: AppMessageKey) => string, category: ModelCategory): string {
  switch (category) {
    case "Fast":
      return t("ai.fast");
    case "General":
      return t("ai.general");
    case "Advanced":
      return t("ai.advanced");
    case "Coding":
      return t("ai.coding");
    case "Writing":
      return t("ai.writing");
    default:
      return category;
  }
}

interface ModelSelectorProps {
  models: AiModel[];
  selectedModel: AiModel;
  onSelectModel: (model: AiModel) => void;
  disabled?: boolean;
  isChurchAdmin?: boolean;
  onSetDefault?: (modelId: string) => Promise<void>;
  defaultModelId?: string;
}

const CATEGORY_ICONS: Record<ModelCategory, typeof Zap> = {
  Fast: Zap,
  General: Layers,
  Advanced: Cpu,
  Coding: Terminal,
  Writing: PenTool,
};

const CATEGORY_COLORS: Record<ModelCategory, { bg: string; text: string; border: string }> = {
  Fast: { bg: "color-mix(in srgb, #e8a317 15%, transparent)", text: "#d97706", border: "#f59e0b" },
  General: { bg: "color-mix(in srgb, var(--pri) 15%, transparent)", text: "var(--pri)", border: "var(--pri)" },
  Advanced: { bg: "color-mix(in srgb, var(--violet) 18%, transparent)", text: "var(--violet)", border: "var(--violet)" },
  Coding: { bg: "color-mix(in srgb, #10b981 16%, transparent)", text: "#059669", border: "#10b981" },
  Writing: { bg: "color-mix(in srgb, #ec4899 16%, transparent)", text: "#db2777", border: "#ec4899" },
};

export default function ModelSelector({
  models,
  selectedModel,
  onSelectModel,
  disabled = false,
  isChurchAdmin = false,
  onSetDefault,
  defaultModelId,
}: ModelSelectorProps) {
  const { t, locale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [settingDefault, setSettingDefault] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const categories = useMemo(() => {
    const list: Array<{ id: string; label: string; icon?: typeof Zap }> = [
      { id: "all", label: t("ai.allCategories"), icon: Layers },
      { id: "Fast", label: t("ai.fast"), icon: Zap },
      { id: "General", label: t("ai.general"), icon: Layers },
      { id: "Advanced", label: t("ai.advanced"), icon: Cpu },
      { id: "Writing", label: t("ai.writing"), icon: PenTool },
      { id: "Coding", label: t("ai.coding"), icon: Terminal },
    ];
    return list;
  }, [t]);

  // Filter models
  const filteredModels = useMemo(() => {
    const query = search.trim().toLowerCase();
    return models.filter((m) => {
      if (selectedCategory !== "all" && m.category !== selectedCategory) {
        return false;
      }
      if (!query) return true;
      return (
        m.name.toLowerCase().includes(query) ||
        m.apiModelId.toLowerCase().includes(query) ||
        m.providerName.toLowerCase().includes(query) ||
        m.category.toLowerCase().includes(query) ||
        m.description.toLowerCase().includes(query) ||
        m.descriptionAr.toLowerCase().includes(query)
      );
    });
  }, [models, search, selectedCategory]);

  // Group by provider
  const groupedModels = useMemo(() => {
    const groups: Record<string, AiModel[]> = {};
    for (const m of filteredModels) {
      if (!groups[m.providerName]) {
        groups[m.providerName] = [];
      }
      groups[m.providerName].push(m);
    }
    return groups;
  }, [filteredModels]);

  const handleModelClick = (model: AiModel) => {
    if (model.status !== "live") return;
    onSelectModel(model);
    setIsOpen(false);
  };

  const handleSetChurchDefault = async (e: React.MouseEvent, modelId: string) => {
    e.stopPropagation();
    if (!onSetDefault || settingDefault) return;
    setSettingDefault(true);
    try {
      await onSetDefault(modelId);
    } finally {
      setSettingDefault(false);
    }
  };

  const CategoryIcon = CATEGORY_ICONS[selectedModel.category] || Sparkles;
  const catColor = CATEGORY_COLORS[selectedModel.category] || CATEGORY_COLORS.General;

  return (
    <div className="model-selector-container" ref={containerRef} style={{ position: "relative" }}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="model-selector-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={t("ai.modelSelector")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 14px",
          background: "var(--card)",
          border: isOpen ? "1.5px solid var(--pri)" : "1px solid var(--line)",
          borderRadius: "var(--r-md)",
          boxShadow: isOpen ? "0 0 0 3px color-mix(in srgb, var(--pri) 20%, transparent)" : "var(--shadow-sm)",
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "all 0.15s ease",
          maxWidth: "100%",
          textAlign: "inherit",
          userSelect: "none",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "24px",
            height: "24px",
            borderRadius: "6px",
            background: catColor.bg,
            color: catColor.text,
            flexShrink: 0,
          }}
        >
          <CategoryIcon size={14} />
        </span>

        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
            <span
              style={{
                fontWeight: 700,
                fontSize: "0.9rem",
                color: "var(--ink)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {selectedModel.name}
            </span>
            <span
              style={{
                fontSize: "0.72rem",
                padding: "1px 6px",
                borderRadius: "4px",
                background: "color-mix(in srgb, var(--ink) 6%, transparent)",
                color: "var(--mute)",
                fontWeight: 500,
              }}
            >
              {selectedModel.providerName}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: "var(--mute)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: selectedModel.status === "live" ? "var(--ok)" : "var(--danger)",
                }}
              />
              {selectedModel.status === "live" ? t("ai.live") : t("ai.unavailable")}
            </span>
            <span>•</span>
            <span style={{ color: catColor.text, fontWeight: 600 }}>
              {getCategoryLabel(t, selectedModel.category)}
            </span>
          </div>
        </div>

        <ChevronDown
          size={16}
          style={{
            marginLeft: locale === "ar" ? 0 : "4px",
            marginRight: locale === "ar" ? "4px" : 0,
            color: "var(--mute)",
            transition: "transform 0.2s ease",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
        />
      </button>

      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div
          className="model-selector-dropdown animate-fade-in"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: locale === "ar" ? 0 : "auto",
            left: locale === "ar" ? "auto" : 0,
            width: "min(440px, 92vw)",
            maxHeight: "80vh",
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-lg)",
            boxShadow: "var(--shadow-md), 0 20px 40px rgba(0,0,0,0.15)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Search Header */}
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid var(--line)",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              background: "color-mix(in srgb, var(--card) 95%, var(--bg))",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Search size={16} style={{ color: "var(--mute)", flexShrink: 0 }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("ai.searchModels")}
                autoFocus
                style={{
                  width: "100%",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: "0.88rem",
                  color: "var(--ink)",
                  fontFamily: "inherit",
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--mute)",
                    padding: 0,
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div
              style={{
                display: "flex",
                gap: "6px",
                overflowX: "auto",
                paddingBottom: "2px",
                scrollbarWidth: "none",
              }}
            >
              {categories.map((cat) => {
                const active = selectedCategory === cat.id;
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "4px 10px",
                      borderRadius: "14px",
                      fontSize: "0.76rem",
                      fontWeight: active ? 600 : 500,
                      background: active ? "var(--pri)" : "color-mix(in srgb, var(--ink) 5%, transparent)",
                      color: active ? "#ffffff" : "var(--mute)",
                      border: "none",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {Icon && <Icon size={12} />}
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model Items List */}
          <div
            style={{
              padding: "8px",
              overflowY: "auto",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {Object.keys(groupedModels).length === 0 ? (
              <div
                style={{
                  padding: "32px 16px",
                  textAlign: "center",
                  color: "var(--mute)",
                  fontSize: "0.85rem",
                }}
              >
                {locale === "ar" ? "لم يتم العثور على نماذج تطابق بحثك" : "No models found matching your query"}
              </div>
            ) : (
              Object.entries(groupedModels).map(([provider, providerModels]) => (
                <div key={provider} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--mute)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{provider}</span>
                    <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>
                      {providerModels.length} {locale === "ar" ? "نموذج" : "models"}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {providerModels.map((m) => {
                      const isSelected = m.id === selectedModel.id;
                      const isDefault = defaultModelId === m.id;
                      const isLive = m.status === "live";
                      const itemCatColor = CATEGORY_COLORS[m.category] || CATEGORY_COLORS.General;
                      const ItemCatIcon = CATEGORY_ICONS[m.category] || Sparkles;

                      return (
                        <div
                          key={m.id}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => handleModelClick(m)}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            padding: "10px 12px",
                            borderRadius: "var(--r-md)",
                            background: isSelected
                              ? "color-mix(in srgb, var(--pri) 8%, var(--card))"
                              : "transparent",
                            border: isSelected
                              ? "1.5px solid var(--pri)"
                              : "1px solid color-mix(in srgb, var(--line) 60%, transparent)",
                            cursor: isLive ? "pointer" : "not-allowed",
                            opacity: isLive ? 1 : 0.65,
                            transition: "all 0.15s ease",
                          }}
                        >
                          {/* Row 1: Model Name + Category & Status + Check */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "8px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  width: "22px",
                                  height: "22px",
                                  borderRadius: "6px",
                                  background: itemCatColor.bg,
                                  color: itemCatColor.text,
                                  flexShrink: 0,
                                }}
                              >
                                <ItemCatIcon size={12} />
                              </span>

                              <span
                                style={{
                                  fontWeight: 700,
                                  fontSize: "0.88rem",
                                  color: isSelected ? "var(--pri)" : "var(--ink)",
                                }}
                              >
                                {m.name}
                              </span>

                              {/* Category tag */}
                              <span
                                style={{
                                  fontSize: "0.68rem",
                                  fontWeight: 600,
                                  padding: "1px 6px",
                                  borderRadius: "10px",
                                  background: itemCatColor.bg,
                                  color: itemCatColor.text,
                                }}
                              >
                                {getCategoryLabel(t, m.category)}
                              </span>

                              {m.isRecommended && (
                                <span
                                  style={{
                                    fontSize: "0.65rem",
                                    fontWeight: 700,
                                    padding: "1px 6px",
                                    borderRadius: "10px",
                                    background: "color-mix(in srgb, #f59e0b 16%, transparent)",
                                    color: "#d97706",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "2px",
                                  }}
                                >
                                  <Flame size={10} />
                                  {t("ai.recommended")}
                                </span>
                              )}
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                              {isLive ? (
                                <span
                                  style={{
                                    fontSize: "0.68rem",
                                    padding: "2px 6px",
                                    borderRadius: "10px",
                                    background: "var(--ok-soft)",
                                    color: "var(--ok)",
                                    fontWeight: 600,
                                  }}
                                >
                                  {t("ai.live")}
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: "0.68rem",
                                    padding: "2px 6px",
                                    borderRadius: "10px",
                                    background: "var(--danger-soft)",
                                    color: "var(--danger)",
                                    fontWeight: 600,
                                  }}
                                >
                                  {t("ai.unavailable")}
                                </span>
                              )}

                              {isSelected && (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: "20px",
                                    height: "20px",
                                    borderRadius: "50%",
                                    background: "var(--pri)",
                                    color: "#ffffff",
                                  }}
                                >
                                  <Check size={12} strokeWidth={3} />
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Row 2: Short localized description */}
                          <p
                            style={{
                              margin: 0,
                              fontSize: "0.78rem",
                              color: "var(--mute)",
                              lineHeight: 1.4,
                            }}
                          >
                            {locale === "ar" ? m.descriptionAr : m.description}
                          </p>

                          {/* Status Note if unavailable */}
                          {!isLive && (m.statusNoteAr || m.statusNote) && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                background: "var(--warn-soft)",
                                color: "var(--warn)",
                                fontSize: "0.72rem",
                              }}
                            >
                              <Info size={12} style={{ flexShrink: 0 }} />
                              <span>{locale === "ar" ? m.statusNoteAr : m.statusNote}</span>
                            </div>
                          )}

                          {/* Row 3: Meta & Pricing & Set Default */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              fontSize: "0.72rem",
                              color: "var(--mute)",
                              paddingTop: "4px",
                              borderTop: "1px dashed color-mix(in srgb, var(--line) 40%, transparent)",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <span style={{ fontFamily: "monospace", opacity: 0.85 }}>
                                {m.apiModelId}
                              </span>

                              {m.capabilities.contextWindow && (
                                <>
                                  <span>•</span>
                                  <span>
                                    {Math.round(m.capabilities.contextWindow / 1000)}k {locale === "ar" ? "سياق" : "ctx"}
                                  </span>
                                </>
                              )}

                              {m.pricing && (
                                <>
                                  <span>•</span>
                                  <span style={{ fontWeight: 500, color: "var(--ink)" }}>
                                    {m.pricing.inputPer1mEgp.toFixed(1)} / {m.pricing.outputPer1mEgp.toFixed(1)} ج.م
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Set as church default button for admins */}
                            {isChurchAdmin && isLive && (
                              <button
                                type="button"
                                onClick={(e) => handleSetChurchDefault(e, m.id)}
                                disabled={settingDefault || isDefault}
                                style={{
                                  background: isDefault
                                    ? "color-mix(in srgb, var(--ok) 12%, transparent)"
                                    : "transparent",
                                  color: isDefault ? "var(--ok)" : "var(--pri)",
                                  border: "none",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  fontSize: "0.7rem",
                                  fontWeight: 600,
                                  cursor: isDefault ? "default" : "pointer",
                                }}
                              >
                                {isDefault ? t("ai.activeDefault") : t("ai.saveAsDefault")}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
