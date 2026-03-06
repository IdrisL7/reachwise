"use client";

import { useState, useEffect } from "react";

interface Notification {
  id: string;
  type: "draft_pending" | "sequence_completed" | "lead_replied" | "auto_paused";
  title: string;
  body: string | null;
  leadId: string | null;
  messageId: string | null;
  read: number;
  createdAt: string;
}

export default function InboxPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);

  useEffect(() => {
    fetchNotifications();
  }, []);

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: 1 } : n)),
    );
  }

  async function approveDraft(messageId: string) {
    setApproving(messageId);
    try {
      const res = await fetch(`/api/drafts/${messageId}/approve`, { method: "POST" });
      if (res.ok) {
        await fetchNotifications();
      }
    } catch {
      // silently fail
    } finally {
      setApproving(null);
    }
  }

  async function rejectDraft(messageId: string) {
    try {
      const res = await fetch(`/api/drafts/${messageId}/reject`, { method: "POST" });
      if (res.ok) {
        await fetchNotifications();
      }
    } catch {
      // silently fail
    }
  }

  const drafts = notifications.filter((n) => n.type === "draft_pending");
  const activity = notifications.filter((n) => n.type !== "draft_pending");
  const unreadCount = notifications.filter((n) => n.read === 0).length;

  const typeStyles: Record<string, string> = {
    draft_pending: "text-amber-400 bg-amber-900/30 border-amber-800",
    sequence_completed: "text-emerald-400 bg-emerald-900/30 border-emerald-800",
    lead_replied: "text-blue-400 bg-blue-900/30 border-blue-800",
    auto_paused: "text-red-400 bg-red-900/30 border-red-800",
  };

  const typeLabels: Record<string, string> = {
    draft_pending: "Draft",
    sequence_completed: "Completed",
    lead_replied: "Reply",
    auto_paused: "Paused",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
      </div>

      {/* Pending Drafts */}
      {drafts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">
            Pending Drafts ({drafts.length})
          </h2>
          <div className="space-y-3">
            {drafts.map((d) => (
              <div key={d.id} className="bg-zinc-900 border border-amber-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border text-amber-400 bg-amber-900/30 border-amber-800">
                      Draft
                    </span>
                    <span className="text-sm font-medium text-zinc-200">{d.title}</span>
                  </div>
                  <span className="text-[10px] text-zinc-600">
                    {new Date(d.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {d.body && (
                  <p className="text-xs text-zinc-400 mb-3 line-clamp-2">{d.body}</p>
                )}
                {d.messageId && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => approveDraft(d.messageId!)}
                      disabled={approving === d.messageId}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
                    >
                      {approving === d.messageId ? "Approving..." : "Approve & Send"}
                    </button>
                    <button
                      onClick={() => rejectDraft(d.messageId!)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">
          Recent Activity
        </h2>
        {activity.length === 0 && notifications.length > 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
            <p className="text-sm text-zinc-500">No activity yet. Sequences will show up here when they run.</p>
          </div>
        ) : activity.length > 0 ? (
          <div className="space-y-2">
            {activity.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.read && markRead(n.id)}
                className={`bg-zinc-900 border rounded-lg px-4 py-3 cursor-pointer transition-colors ${
                  n.read ? "border-zinc-800" : "border-zinc-700 bg-zinc-900/80"
                }`}
              >
                <div className="flex items-center gap-2">
                  {!n.read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  )}
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${typeStyles[n.type] || "text-zinc-400 bg-zinc-800 border-zinc-700"}`}>
                    {typeLabels[n.type] || n.type}
                  </span>
                  <span className="text-sm text-zinc-200 flex-1">{n.title}</span>
                  <span className="text-[10px] text-zinc-600 shrink-0">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {n.body && (
                  <p className="text-xs text-zinc-500 mt-1 ml-4">{n.body}</p>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Empty state */}
      {notifications.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-10 text-center">
          <h2 className="text-lg font-semibold text-zinc-200 mb-2">Your inbox is empty</h2>
          <p className="text-sm text-zinc-500 max-w-md mx-auto">
            When sequences generate drafts for approval or complete, they&#39;ll appear here.
          </p>
        </div>
      )}
    </div>
  );
}
