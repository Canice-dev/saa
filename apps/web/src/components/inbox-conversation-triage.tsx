"use client";

import { Check, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type InboxConversationTriageProps = {
  conversationId: string;
  messageCount: number;
  state: string;
};

export function InboxConversationTriage({ conversationId, messageCount, state }: InboxConversationTriageProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const lastReadRequestRef = useRef<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(false);
  const isClosed = state === "closed";

  useEffect(() => {
    const requestKey = `${conversationId}:${messageCount}`;
    const element = containerRef.current;
    if (!element || lastReadRequestRef.current === requestKey) return;

    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting || lastReadRequestRef.current === requestKey) return;
      lastReadRequestRef.current = requestKey;
      void fetch(`/api/inbox/conversations/${encodeURIComponent(conversationId)}/read`, {
        method: "POST",
        credentials: "same-origin",
      }).then((response) => {
        if (response.ok) router.refresh();
      }).catch(() => undefined);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [conversationId, messageCount, router]);

  async function updateState() {
    setUpdating(true);
    setError(false);
    try {
      const response = await fetch(`/api/inbox/conversations/${encodeURIComponent(conversationId)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: isClosed ? "open" : "closed" }),
      });
      if (!response.ok) throw new Error("Conversation state update failed");
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="thread-status-actions" ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={updateState}
        disabled={updating}
        aria-label={isClosed ? "Reopen conversation" : "Resolve conversation"}
        title={error ? "Could not update conversation" : undefined}
      >
        {isClosed ? <RotateCcw aria-hidden="true" /> : <Check aria-hidden="true" />}
        <span className="thread-status-label">{updating ? "Updating…" : isClosed ? "Reopen" : "Resolve"}</span>
      </Button>
      {error && <span className="thread-status-error" role="status">Could not update</span>}
    </div>
  );
}
