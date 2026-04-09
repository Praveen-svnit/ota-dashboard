"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  mode?: "deterministic" | "anthropic";
  followUps?: string[];
}

const COPILOT_PROMPTS = [
  "Give me a full production health check — what's performing well and what needs attention?",
  "Which OTAs are underperforming vs their live property share? Where are we losing RNs?",
  "Analyse the day-on-day trends for this month. Any anomalies or drops I should know about?",
  "Which cities have the highest production per live property? Where should we focus expansion?",
  "Compare this month vs last month. What's driving the delta?",
  "Give me a prioritised action plan for the next 7 days to improve RN output.",
];

function renderRichText(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("## "))
      return <h4 key={i} style={{ margin: "14px 0 6px", fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{line.slice(3)}</h4>;
    if (line.startsWith("### "))
      return <h5 key={i} style={{ margin: "10px 0 4px", fontSize: 12, fontWeight: 800, color: "#1E293B" }}>{line.slice(4)}</h5>;
    if (line.startsWith("- ") || line.startsWith("• "))
      return (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
          <span style={{ color: "#2563EB", fontWeight: 800, flexShrink: 0 }}>•</span>
          <span>{line.slice(2)}</span>
        </div>
      );
    if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1] ?? "";
      return (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
          <span style={{ color: "#2563EB", fontWeight: 700, minWidth: 18, flexShrink: 0 }}>{num}.</span>
          <span>{line.replace(/^\d+\.\s/, "")}</span>
        </div>
      );
    }
    if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
    return <p key={i} style={{ margin: "3px 0", lineHeight: 1.7 }}>{line}</p>;
  });
}

export default function AIInsightsView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setMessages(prev => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);

      setMessages(prev => [...prev, {
        role: "assistant",
        content: json.answer ?? "No answer returned.",
        mode: json.mode,
        followUps: json.followUps ?? [],
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `⚠ Error: ${err instanceof Error ? err.message : "Unknown error"}. Make sure ANTHROPIC_API_KEY is set in your .env.local file.`,
        mode: "deterministic",
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 160px)" }}>

      {/* Header */}
      <div style={{
        background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "12px 12px 0 0",
        padding: "14px 20px", borderBottom: "none", display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: "50%",
          background: "linear-gradient(135deg, #0F172A, #1D4ED8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, boxShadow: "0 4px 12px rgba(29,78,216,0.25)",
          color: "#FFF", fontSize: 14, fontWeight: 900,
        }}>AI</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>OTA Guru — Executive Analytics Copilot</div>
          <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 1 }}>
            Live dashboard data · Deterministic + LLM analysis · Powered by Claude
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} style={{
            marginLeft: "auto", fontSize: 11, color: "#94A3B8",
            background: "#F8FAFC", border: "1px solid #E2E8F0",
            borderRadius: 7, padding: "5px 12px", cursor: "pointer",
          }}>
            Clear chat
          </button>
        )}
      </div>

      {/* Chat area */}
      <div style={{
        flex: 1, background: "#F8FAFC", border: "1px solid #E2E8F0",
        borderTop: "none", borderBottom: "none", overflowY: "auto", padding: 20,
      }}>
        {messages.length === 0 ? (
          <div>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{
                width: 60, height: 60, borderRadius: "50%",
                background: "linear-gradient(135deg, #0F172A, #1D4ED8)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 12px", color: "#FFF", fontSize: 22, fontWeight: 900,
                boxShadow: "0 8px 24px rgba(29,78,216,0.2)",
              }}>AI</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", marginBottom: 6 }}>
                Ask anything about production data
              </div>
              <div style={{ fontSize: 11, color: "#64748B", maxWidth: 420, margin: "0 auto", lineHeight: 1.6 }}>
                Live OTA performance, RNs, city trends, MTD listings — the copilot reads the same snapshot as the dashboard and gives you actionable diagnosis.
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textAlign: "center", marginBottom: 12 }}>Suggested prompts</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 720, margin: "0 auto" }}>
              {COPILOT_PROMPTS.map((prompt, i) => (
                <button key={i} onClick={() => sendMessage(prompt)} style={{
                  textAlign: "left", padding: "12px 14px", borderRadius: 10,
                  border: "1px solid #E2E8F0", background: "#FFF", cursor: "pointer",
                  fontSize: 11, color: "#475569", lineHeight: 1.5,
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#1D4ED8"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(29,78,216,0.1)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.boxShadow = "none"; }}>
                  <span style={{ fontSize: 14, marginRight: 6 }}>
                    {["📊","📉","📅","🏙️","📆","🎯"][i]}
                  </span>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                flexDirection: msg.role === "user" ? "row-reverse" : "row",
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                  background: msg.role === "user"
                    ? "linear-gradient(135deg, #2563EB, #3B82F6)"
                    : "linear-gradient(135deg, #0F172A, #1D4ED8)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, color: "#FFF", fontWeight: 900,
                }}>
                  {msg.role === "user" ? "U" : "AI"}
                </div>
                <div style={{
                  maxWidth: "82%",
                  background: msg.role === "user" ? "#1D4ED8" : "#FFF",
                  color: msg.role === "user" ? "#FFF" : "#1E293B",
                  border: msg.role === "user" ? "none" : "1px solid #E2E8F0",
                  borderRadius: msg.role === "user" ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
                  padding: "12px 16px", fontSize: 12, lineHeight: 1.7,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                }}>
                  {msg.role === "assistant" && msg.mode && (
                    <div style={{ marginBottom: 8, fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94A3B8" }}>
                      {msg.mode === "anthropic" ? "✦ LLM Assisted" : "⊞ Deterministic Analysis"}
                    </div>
                  )}
                  <div style={{ fontSize: 12 }}>
                    {msg.role === "assistant" ? renderRichText(msg.content) : msg.content}
                  </div>
                  {msg.role === "assistant" && msg.followUps && msg.followUps.length > 0 && (
                    <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {msg.followUps.map(f => (
                        <button key={f} onClick={() => sendMessage(f)} style={{
                          padding: "6px 10px", borderRadius: 999,
                          border: "1px solid #BFDBFE", background: "#EFF6FF",
                          color: "#1D4ED8", fontSize: 11, fontWeight: 700, cursor: "pointer",
                        }}>
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, #0F172A, #1D4ED8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#FFF", fontWeight: 900, flexShrink: 0 }}>AI</div>
                <div style={{ padding: "12px 16px", borderRadius: "4px 12px 12px 12px", background: "#FFF", border: "1px solid #E2E8F0", fontSize: 12, color: "#94A3B8", fontStyle: "italic" }}>
                  Thinking through the live data…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "0 0 12px 12px",
        padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-end",
      }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder="Ask about OTA drops, city opportunity, run-rate recovery, anything… (Enter to send)"
          rows={1}
          style={{
            flex: 1, resize: "none", padding: "10px 14px", borderRadius: 10,
            border: "1px solid #E2E8F0", fontSize: 12, outline: "none",
            fontFamily: "inherit", lineHeight: 1.5, maxHeight: 120, overflowY: "auto",
            color: "#1E293B", background: loading ? "#F8FAFC" : "#FFF",
          }}
          onInput={e => {
            const t = e.currentTarget;
            t.style.height = "auto";
            t.style.height = Math.min(t.scrollHeight, 120) + "px";
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{
            padding: "10px 18px", borderRadius: 10, border: "none",
            background: loading || !input.trim() ? "#F1F5F9" : "linear-gradient(135deg, #0F172A, #1D4ED8)",
            color: loading || !input.trim() ? "#94A3B8" : "#FFF",
            fontSize: 12, fontWeight: 800,
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            flexShrink: 0,
          }}
        >
          {loading ? "Analysing…" : "Ask Copilot"}
        </button>
      </div>
    </div>
  );
}
