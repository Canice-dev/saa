"use client";

import { Check, CheckCheck, Copy } from "lucide-react";
import { useState } from "react";

type InboxMessageProps = {
  body: string;
  deliveryStatus: string | null;
  outgoing: boolean;
  sender: string;
  time: string;
};

export function InboxMessage({ body, deliveryStatus, outgoing, sender, time }: InboxMessageProps) {
  const [copied, setCopied] = useState(false);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className={`message-bubble${outgoing ? " message-bubble--outgoing" : ""}`}>
      <span className="message-sender">{sender}</span>
      <p>{body}</p>
      <span className="message-time">{time}{outgoing && deliveryStatus ? ` · ${deliveryStatus}` : ""}</span>
      {outgoing && deliveryStatus && <CheckCheck className="message-check" size={13} aria-label={deliveryStatus} />}
      <button className="message-copy-action" type="button" onClick={copyMessage} aria-label={copied ? "Message copied" : "Copy message"} title={copied ? "Copied" : "Copy message"}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </article>
  );
}
