/**
 * AlwayZ — PersonaScraper.tsx
 *
 * Drop this into the memory intake form (PersonaTraining.tsx).
 * User pastes up to 6 URLs (obituary, Facebook, LinkedIn, memorial, etc.)
 * The component calls the Netlify function, gets back structured persona
 * signals, and calls onExtracted() so the parent form auto-populates.
 *
 * Usage:
 *   <PersonaScraper onExtracted={(signals) => applyToForm(signals)} />
 */

import { useState, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PersonaSignals {
  name: string | null;
  relationship_clues: string[];
  personality_traits: string[];
  speaking_style: string | null;
  favorite_sayings: string[];
  topics_they_loved: string[];
  people_they_loved: string[];
  life_stories: string[];
  values: string[];
  career_identity: string | null;
  humor_style: string | null;
  sources_used: string[];
}

interface SourceMeta {
  url: string;
  label: string;
  status: "ok" | "error";
  chars?: number;
  error?: string;
}

interface Props {
  onExtracted: (signals: PersonaSignals) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLACEHOLDER_URLS = [
  "https://www.legacy.com/obituaries/…",
  "https://www.facebook.com/…",
  "https://www.linkedin.com/in/…",
  "https://www.tributearchive.com/…",
  "https://www.findagrave.com/…",
  "",
];

const SOURCE_ICONS: Record<string, string> = {
  "legacy.com": "📰",
  "facebook.com": "👤",
  "linkedin.com": "💼",
  "tributearchive.com": "🕊️",
  "findagrave.com": "🪦",
  "instagram.com": "📷",
  "twitter.com": "🐦",
  "x.com": "🐦",
  "news": "📰",
};

function sourceIcon(label: string): string {
  for (const [key, icon] of Object.entries(SOURCE_ICONS)) {
    if (label.includes(key)) return icon;
  }
  return "🔗";
}

function countSignals(p: PersonaSignals): number {
  return [
    p.personality_traits,
    p.favorite_sayings,
    p.topics_they_loved,
    p.people_they_loved,
    p.life_stories,
    p.values,
  ].reduce((acc, arr) => acc + (arr?.length || 0), 0) +
    (p.speaking_style ? 1 : 0) +
    (p.humor_style ? 1 : 0) +
    (p.career_identity ? 1 : 0);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PersonaScraper({ onExtracted }: Props) {
  const [urls, setUrls] = useState<string[]>(["", ""]);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [sources, setSources] = useState<SourceMeta[]>([]);
  const [signals, setSignals] = useState<PersonaSignals | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [applied, setApplied] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── URL management ──────────────────────────────────────────────────────────

  function updateUrl(index: number, value: string) {
    const next = [...urls];
    next[index] = value;
    // Auto-add a new empty field when user fills the last one (max 6)
    if (index === next.length - 1 && value.trim() && next.length < 6) {
      next.push("");
    }
    setUrls(next);
  }

  function removeUrl(index: number) {
    const next = urls.filter((_, i) => i !== index);
    setUrls(next.length > 0 ? next : [""]);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, index: number) {
    const pasted = e.clipboardData.getData("text");
    // If multi-line paste, distribute across fields
    const lines = pasted
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith("http"));
    if (lines.length > 1) {
      e.preventDefault();
      const next = [...urls];
      lines.forEach((line, i) => {
        if (index + i < 6) next[index + i] = line;
      });
      if (next.length < 6) next.push("");
      setUrls(next.slice(0, 6));
    }
  }

  // ── Scrape ──────────────────────────────────────────────────────────────────

  async function handleScrape() {
    const validUrls = urls.filter((u) => u.trim().startsWith("http"));
    if (validUrls.length === 0) return;

    setStatus("loading");
    setSignals(null);
    setSources([]);
    setErrorMsg("");
    setApplied(false);

    try {
      const res = await fetch("/.netlify/functions/scrape-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: validUrls }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Server error ${res.status}`);
      }

      setSources(data.sources || []);
      setSignals(data.persona);
      setStatus("success");
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong");
      setStatus("error");
    }
  }

  function handleApply() {
    if (!signals) return;
    onExtracted(signals);
    setApplied(true);
  }

  // ── Derived state ───────────────────────────────────────────────────────────

  const validCount = urls.filter((u) => u.trim().startsWith("http")).length;
  const signalCount = signals ? countSignals(signals) : 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={styles.wrapper}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.headerIcon}>🔍</span>
          <div>
            <div style={styles.headerTitle}>Import from the Web</div>
            <div style={styles.headerSub}>
              Paste links to obituaries, social profiles, or memorial pages —
              we'll extract their personality automatically
            </div>
          </div>
        </div>
      </div>

      {/* URL inputs */}
      <div style={styles.urlList}>
        {urls.map((url, i) => (
          <div key={i} style={styles.urlRow}>
            <span style={styles.urlIcon}>
              {url.trim().startsWith("http")
                ? sourceIcon(
                    (() => {
                      try {
                        return new URL(url).hostname.replace("www.", "");
                      } catch {
                        return "";
                      }
                    })()
                  )
                : "🔗"}
            </span>
            <input
              ref={(el) => (inputRefs.current[i] = el)}
              style={{
                ...styles.urlInput,
                ...(url.trim().startsWith("http") ? styles.urlInputFilled : {}),
              }}
              type="url"
              value={url}
              placeholder={PLACEHOLDER_URLS[i] || "https://…"}
              onChange={(e) => updateUrl(i, e.target.value)}
              onPaste={(e) => handlePaste(e, i)}
              disabled={status === "loading"}
            />
            {url.trim() && (
              <button
                style={styles.removeBtn}
                onClick={() => removeUrl(i)}
                title="Remove"
                disabled={status === "loading"}
              >
                ×
              </button>
            )}
          </div>
        ))}

        {urls.length < 6 && (
          <button
            style={styles.addBtn}
            onClick={() => setUrls([...urls, ""])}
            disabled={status === "loading"}
          >
            + Add another URL
          </button>
        )}
      </div>

      {/* Hints */}
      <div style={styles.hints}>
        <span style={styles.hint}>📰 Legacy.com obituary</span>
        <span style={styles.hint}>👤 Facebook profile</span>
        <span style={styles.hint}>💼 LinkedIn</span>
        <span style={styles.hint}>🕊️ Tribute / memorial page</span>
        <span style={styles.hint}>📰 Local news article</span>
      </div>

      {/* Scrape button */}
      <button
        style={{
          ...styles.scrapeBtn,
          ...(validCount === 0 || status === "loading"
            ? styles.scrapeBtnDisabled
            : {}),
        }}
        onClick={handleScrape}
        disabled={validCount === 0 || status === "loading"}
      >
        {status === "loading" ? (
          <span style={styles.loadingRow}>
            <span style={styles.spinner} />
            Analyzing {validCount} source{validCount !== 1 ? "s" : ""}…
          </span>
        ) : (
          `Extract Persona Signals${validCount > 0 ? ` from ${validCount} source${validCount !== 1 ? "s" : ""}` : ""}`
        )}
      </button>

      {/* Error */}
      {status === "error" && (
        <div style={styles.errorBox}>
          <strong>⚠️ Extraction failed</strong>
          <div style={{ marginTop: 4, fontSize: 13 }}>{errorMsg}</div>
        </div>
      )}

      {/* Results */}
      {status === "success" && signals && (
        <div style={styles.results}>
          {/* Source status row */}
          <div style={styles.sourceRow}>
            {sources.map((s, i) => (
              <div
                key={i}
                style={{
                  ...styles.sourceChip,
                  ...(s.status === "error" ? styles.sourceChipError : styles.sourceChipOk),
                }}
                title={s.status === "error" ? s.error : `${s.chars?.toLocaleString()} characters read`}
              >
                {sourceIcon(s.label)} {s.label}{" "}
                {s.status === "ok" ? "✓" : "✗"}
              </div>
            ))}
          </div>

          {/* Signal preview */}
          <div style={styles.signalSummary}>
            <span style={styles.signalBadge}>
              🎯 {signalCount} signals extracted
            </span>
            {signals.name && (
              <span style={styles.signalBadge}>👤 {signals.name}</span>
            )}
          </div>

          {/* Preview panels */}
          <div style={styles.previewGrid}>
            {signals.personality_traits.length > 0 && (
              <PreviewPanel
                label="Personality traits"
                items={signals.personality_traits}
                color="#6366f1"
              />
            )}
            {signals.favorite_sayings.length > 0 && (
              <PreviewPanel
                label="Favorite sayings"
                items={signals.favorite_sayings}
                color="#ec4899"
                quote
              />
            )}
            {signals.topics_they_loved.length > 0 && (
              <PreviewPanel
                label="Topics they loved"
                items={signals.topics_they_loved}
                color="#0ea5e9"
              />
            )}
            {signals.life_stories.length > 0 && (
              <PreviewPanel
                label="Life stories"
                items={signals.life_stories}
                color="#10b981"
              />
            )}
            {signals.values.length > 0 && (
              <PreviewPanel
                label="Values"
                items={signals.values}
                color="#f59e0b"
              />
            )}
            {signals.people_they_loved.length > 0 && (
              <PreviewPanel
                label="People they loved"
                items={signals.people_they_loved}
                color="#8b5cf6"
              />
            )}
          </div>

          {signals.speaking_style && (
            <div style={styles.speakingStyle}>
              <span style={styles.speakingStyleLabel}>Speaking style:</span>{" "}
              {signals.speaking_style}
            </div>
          )}

          {signals.humor_style && (
            <div style={styles.speakingStyle}>
              <span style={styles.speakingStyleLabel}>Humor:</span>{" "}
              {signals.humor_style}
            </div>
          )}

          {/* Apply button */}
          <button
            style={{
              ...styles.applyBtn,
              ...(applied ? styles.applyBtnDone : {}),
            }}
            onClick={handleApply}
            disabled={applied}
          >
            {applied
              ? "✓ Applied to memory form"
              : `Apply All ${signalCount} Signals to Memory Form →`}
          </button>

          {applied && (
            <div style={styles.appliedNote}>
              Scroll down to review and edit the pre-filled fields before saving.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-component ────────────────────────────────────────────────────────────

function PreviewPanel({
  label,
  items,
  color,
  quote = false,
}: {
  label: string;
  items: string[];
  color: string;
  quote?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 3);

  return (
    <div style={{ ...styles.previewPanel, borderColor: color + "33" }}>
      <div style={{ ...styles.previewPanelLabel, color }}>
        {label} ({items.length})
      </div>
      <ul style={styles.previewList}>
        {visible.map((item, i) => (
          <li key={i} style={styles.previewItem}>
            {quote ? `"${item}"` : item}
          </li>
        ))}
      </ul>
      {items.length > 3 && (
        <button
          style={{ ...styles.expandBtn, color }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : `+${items.length - 3} more`}
        </button>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: "20px 20px 24px",
    marginBottom: 24,
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerLeft: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
  },
  headerIcon: {
    fontSize: 22,
    marginTop: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "white",
    marginBottom: 3,
  },
  headerSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    lineHeight: 1.4,
    maxWidth: 440,
  },
  urlList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 12,
  },
  urlRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  urlIcon: {
    fontSize: 16,
    width: 22,
    textAlign: "center",
    flexShrink: 0,
  },
  urlInput: {
    flex: 1,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    outline: "none",
    transition: "border-color 0.2s",
    fontFamily: "inherit",
  },
  urlInputFilled: {
    color: "rgba(255,255,255,0.9)",
    borderColor: "rgba(99,102,241,0.5)",
  },
  removeBtn: {
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.3)",
    fontSize: 18,
    cursor: "pointer",
    padding: "0 4px",
    lineHeight: 1,
    flexShrink: 0,
  },
  addBtn: {
    background: "none",
    border: "1px dashed rgba(255,255,255,0.2)",
    borderRadius: 8,
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    padding: "8px 14px",
    cursor: "pointer",
    textAlign: "left",
    marginLeft: 30,
    transition: "border-color 0.2s, color 0.2s",
  },
  hints: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 16,
    marginLeft: 30,
  },
  hint: {
    fontSize: 11,
    color: "rgba(255,255,255,0.3)",
    background: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    padding: "3px 8px",
  },
  scrapeBtn: {
    width: "100%",
    padding: "12px 20px",
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    color: "white",
    border: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "opacity 0.2s",
    fontFamily: "inherit",
  },
  scrapeBtnDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  loadingRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  spinner: {
    width: 14,
    height: 14,
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "white",
    borderRadius: "50%",
    display: "inline-block",
    animation: "alwayz-spin 0.7s linear infinite",
  },
  errorBox: {
    marginTop: 12,
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 10,
    padding: "12px 16px",
    color: "#fca5a5",
    fontSize: 13,
  },
  results: {
    marginTop: 16,
  },
  sourceRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  sourceChip: {
    fontSize: 12,
    borderRadius: 20,
    padding: "4px 10px",
    fontWeight: 500,
  },
  sourceChipOk: {
    background: "rgba(16,185,129,0.15)",
    color: "#6ee7b7",
    border: "1px solid rgba(16,185,129,0.3)",
  },
  sourceChipError: {
    background: "rgba(239,68,68,0.1)",
    color: "#fca5a5",
    border: "1px solid rgba(239,68,68,0.2)",
  },
  signalSummary: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  signalBadge: {
    fontSize: 13,
    fontWeight: 600,
    background: "rgba(99,102,241,0.15)",
    border: "1px solid rgba(99,102,241,0.3)",
    color: "#a5b4fc",
    borderRadius: 20,
    padding: "5px 12px",
  },
  previewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 10,
    marginBottom: 12,
  },
  previewPanel: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid transparent",
    borderRadius: 10,
    padding: "12px 14px",
  },
  previewPanelLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  previewList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  previewItem: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 4,
    lineHeight: 1.4,
    paddingLeft: 10,
    position: "relative",
    ":before": { content: '"•"' },
  },
  expandBtn: {
    background: "none",
    border: "none",
    fontSize: 12,
    cursor: "pointer",
    padding: 0,
    marginTop: 4,
    fontFamily: "inherit",
    opacity: 0.8,
  },
  speakingStyle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    background: "rgba(255,255,255,0.04)",
    borderRadius: 8,
    padding: "10px 14px",
    marginBottom: 8,
    lineHeight: 1.5,
  },
  speakingStyleLabel: {
    fontWeight: 600,
    color: "rgba(255,255,255,0.85)",
  },
  applyBtn: {
    width: "100%",
    marginTop: 8,
    padding: "13px 20px",
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "white",
    border: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    transition: "opacity 0.2s",
    fontFamily: "inherit",
  },
  applyBtnDone: {
    background: "rgba(16,185,129,0.2)",
    color: "#6ee7b7",
    cursor: "default",
  },
  appliedNote: {
    marginTop: 8,
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
  },
};

// Inject spinner keyframes once
if (typeof document !== "undefined") {
  const id = "alwayz-scraper-styles";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @keyframes alwayz-spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
}
