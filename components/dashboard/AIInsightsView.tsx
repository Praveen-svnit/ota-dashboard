"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_PROMPTS = [
  "Give me a full production health check — what's performing well and what needs attention?",
  "Which OTAs are underperforming vs their live property share? Where are we losing RNs?",
  "Analyse the day-on-day trends for this month. Any anomalies or drops I should know about?",
  "Which cities have the highest production per live property? Where should we focus expansion?",
  "Compare this month vs last month. What's driving the delta?",
  "Give me a prioritised action plan for the next 7 days to improve RN output.",
];

export default function AIInsightsView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setStreaming(true);

    // Add empty assistant message to stream into
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = { ...last, content: last.content + parsed.text };
                }
                return updated;
              });
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant" && last.content === "") {
          updated[updated.length - 1] = {
            ...last,
            content: `⚠ Error: ${err instanceof Error ? err.message : "Unknown error"}. Make sure ANTHROPIC_API_KEY is set in your .env file.`,
          };
        }
        return updated;
      });
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function formatMessage(text: string) {
    // Basic markdown-like formatting
    return text
      .split("\n")
      .map((line, i) => {
        if (line.startsWith("### ")) return <h4 key={i} style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", margin: "12px 0 4px" }}>{line.slice(4)}</h4>;
        if (line.startsWith("## "))  return <h3 key={i} style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", margin: "14px 0 4px" }}>{line.slice(3)}</h3>;
        if (line.startsWith("# "))   return <h2 key={i} style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", margin: "16px 0 6px" }}>{line.slice(2)}</h2>;
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return <div key={i} style={{ display: "flex", gap: 8, marginBottom: 3 }}>
            <span style={{ color: "#6366F1", flexShrink: 0, marginTop: 1 }}>•</span>
            <span>{renderInline(line.slice(2))}</span>
          </div>;
        }
        if (/^\d+\.\s/.test(line)) {
          const num = line.match(/^(\d+)\./)?.[1];
          return <div key={i} style={{ display: "flex", gap: 8, marginBottom: 3 }}>
            <span style={{ color: "#6366F1", flexShrink: 0, fontWeight: 700, minWidth: 18 }}>{num}.</span>
            <span>{renderInline(line.replace(/^\d+\.\s/, ""))}</span>
          </div>;
        }
        if (line.trim() === "") return <div key={i} style={{ height: 8 }} />;
        return <p key={i} style={{ margin: "2px 0" }}>{renderInline(line)}</p>;
      });
  }

  function renderInline(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={i} style={{ fontWeight: 700, color: "#0F172A" }}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`"))
        return <code key={i} style={{ background: "#F1F5F9", borderRadius: 4, padding: "1px 5px", fontSize: 11, fontFamily: "monospace", color: "#6366F1" }}>{part.slice(1, -1)}</code>;
      return part;
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 160px)", gap: 0 }}>

      {/* Header */}
      <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "12px 12px 0 0",
        padding: "14px 20px", borderBottom: "none", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          boxShadow: "0 4px 12px #6366F140" }}>
          <span style={{ fontSize: 18 }}>🧠</span>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>OTA Guru — Senior Analytics Consultant</div>
          <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 1 }}>
            20+ yrs · OTA & Revenue Analytics · Powered by Claude Sonnet
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])}
            style={{ marginLeft: "auto", fontSize: 11, color: "#94A3B8", background: "#F8FAFC",
              border: "1px solid #E2E8F0", borderRadius: 7, padding: "5px 12px", cursor: "pointer" }}>
            Clear chat
          </button>
        )}
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, background: "#F8FAFC", border: "1px solid #E2E8F0",
        borderTop: "none", borderBottom: "none", overflowY: "auto", padding: "20px" }}>

        {messages.length === 0 ? (
          <div>
            {/* Welcome */}
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%",
                background: "linear-gradient(135deg, #6366F120, #8B5CF220)",
                border: "2px solid #6366F130",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 12px", fontSize: 26 }}>🧠</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", marginBottom: 6 }}>
                What would you like to analyse?
              </div>
              <div style={{ fontSize: 11, color: "#64748B", maxWidth: 420, margin: "0 auto" }}>
                I have real-time access to your production dashboard data — OTA performance, RNs, city trends, MTD listings, and more.
              </div>
            </div>

            {/* Suggested prompts */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 720, margin: "0 auto" }}>
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button key={i} onClick={() => sendMessage(prompt)} style={{
                  textAlign: "left", padding: "12px 14px", borderRadius: 10,
                  border: "1px solid #E2E8F0", background: "#FFF", cursor: "pointer",
                  fontSize: 11, color: "#475569", lineHeight: 1.5,
                  transition: "border-color 0.1s, box-shadow 0.1s",
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#6366F1"; e.currentTarget.style.boxShadow = "0 2px 8px #6366F115"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.boxShadow = "none"; }}>
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
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start",
                flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>

                {/* Avatar */}
                <div style={{
                  width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                  background: msg.role === "user"
                    ? "linear-gradient(135deg, #2563EB, #3B82F6)"
                    : "linear-gradient(135deg, #6366F1, #8B5CF6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: msg.role === "user" ? 11 : 14, color: "#FFF", fontWeight: 800,
                }}>
                  {msg.role === "user" ? "U" : "🧠"}
                </div>

                {/* Bubble */}
                <div style={{
                  maxWidth: "80%",
                  background: msg.role === "user" ? "#2563EB" : "#FFF",
                  color: msg.role === "user" ? "#FFF" : "#1E293B",
                  border: msg.role === "user" ? "none" : "1px solid #E2E8F0",
                  borderRadius: msg.role === "user" ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
                  padding: "12px 16px",
                  fontSize: 12, lineHeight: 1.7,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                }}>
                  {msg.role === "assistant" ? (
                    msg.content === "" && streaming && i === messages.length - 1 ? (
                      <span style={{ color: "#94A3B8", fontStyle: "italic", fontSize: 11 }}>
                        Analysing your data
                        <span style={{ animation: "pulse 1.2s infinite" }}>…</span>
                      </span>
                    ) : (
                      <div style={{ fontSize: 12 }}>{formatMessage(msg.content)}</div>
                    )
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "0 0 12px 12px",
        padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-end" }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder="Ask anything about your production data… (Enter to send, Shift+Enter for new line)"
          rows={1}
          style={{
            flex: 1, resize: "none", padding: "10px 14px", borderRadius: 10,
            border: "1px solid #E2E8F0", fontSize: 12, outline: "none",
            fontFamily: "inherit", lineHeight: 1.5, maxHeight: 120, overflowY: "auto",
            color: "#1E293B", background: loading ? "#F8FAFC" : "#FFF",
          }}
          onInput={(e) => {
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
            background: loading || !input.trim() ? "#F1F5F9" : "linear-gradient(135deg, #6366F1, #8B5CF6)",
            color: loading || !input.trim() ? "#94A3B8" : "#FFF",
            fontSize: 12, fontWeight: 700, cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            flexShrink: 0, transition: "all 0.15s",
          }}
        >
          {loading ? "…" : "Send"}
        </button>
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
      `}</style>
    </div>
  );
}
