"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

type InboxReplyComposerProps = {
  conversationId: string;
  disabledReason?: string;
};

export function InboxReplyComposer({ conversationId, disabledReason }: InboxReplyComposerProps) {
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const router = useRouter();
  const trimmedBody = body.trim();

  async function sendReply() {
    if (!trimmedBody || isSending || disabledReason) return;
    setError("");
    setIsSending(true);

    let response: Response;
    try {
      response = await fetch(`/api/inbox/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmedBody }),
      });
    } catch {
      setError("Connection failed. Your message wasn’t sent.");
      setIsSending(false);
      return;
    }

    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setError(result?.error ?? "Could not send the message. Try again.");
      setIsSending(false);
      return;
    }

    setBody("");
    setIsSending(false);
    router.refresh();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendReply();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !disabledReason) {
      event.preventDefault();
      void sendReply();
    }
  }

  return (
    <div className="reply-composer-wrap">
      {disabledReason ? (
        <p className="reply-composer-note" role="status">{disabledReason}</p>
      ) : (
        <p className="reply-composer-note">WhatsApp reply · Enter to send, Shift + Enter for a new line</p>
      )}
      <form className="reply-composer" aria-label="Reply to customer on WhatsApp" onSubmit={handleSubmit}>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value.slice(0, 4096))}
          onKeyDown={handleKeyDown}
          disabled={isSending}
          maxLength={4096}
          rows={1}
          placeholder="Write a message…"
          aria-label="Write a WhatsApp reply"
        />
        <Button className="reply-send-button" type="submit" size="icon" disabled={isSending || Boolean(disabledReason) || !trimmedBody} aria-label={isSending ? "Sending reply" : "Send reply"}>
          <Send size={16} />
        </Button>
      </form>
      {error && <p className="reply-composer-error" role="alert">{error}</p>}
    </div>
  );
}
