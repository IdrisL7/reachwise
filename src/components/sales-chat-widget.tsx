"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export function SalesChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hey! I'm the GetSignalHooks assistant. I can answer questions about the product, walk you through pricing, or run a live demo — just drop a company URL and I'll generate hooks for it. What can I help with?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/sales-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json();
      if (data.message) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.message },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I had trouble responding. Try again?",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Connection error. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 flex items-center justify-center transition-all"
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden"
          style={{ height: "min(520px, calc(100vh - 8rem))" }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
              GS
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-100">
                GetSignalHooks
              </p>
              <p className="text-xs text-zinc-500">
                Ask anything or drop a URL for a live demo
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-800 text-zinc-200"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <FormattedMessage content={msg.content} />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-zinc-800 text-zinc-400 rounded-lg px-3 py-2 text-sm">
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={sendMessage}
            className="px-4 py-3 border-t border-zinc-800 flex gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about pricing, features, or paste a URL..."
              disabled={loading}
              className="flex-1 bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-600 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}

/** Simple markdown-like formatting for assistant messages */
function FormattedMessage({ content }: { content: string }) {
  // Split by double newline for paragraphs
  const parts = content.split(/\n\n/);

  return (
    <>
      {parts.map((part, i) => {
        // Check for bold text
        const formatted = part.split(/(\*\*[^*]+\*\*)/g).map((segment, j) => {
          if (segment.startsWith("**") && segment.endsWith("**")) {
            return (
              <strong key={j} className="font-semibold text-zinc-100">
                {segment.slice(2, -2)}
              </strong>
            );
          }
          // Check for blockquote lines
          if (segment.startsWith("> ")) {
            return (
              <span key={j} className="block text-xs text-zinc-400 italic border-l-2 border-zinc-700 pl-2 my-1">
                {segment.slice(2)}
              </span>
            );
          }
          return segment;
        });

        return (
          <span key={i}>
            {i > 0 && <br />}
            {formatted}
          </span>
        );
      })}
    </>
  );
}
