"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageGroup } from "@/components/ui/message";

type InboxMessageProps = {
  body: string;
  avatarInitial: string;
  deliveryStatus: string | null;
  outgoing: boolean;
  time: string;
};

export function InboxMessage({ body, avatarInitial, deliveryStatus, outgoing, time }: InboxMessageProps) {
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
    <MessageGroup className="message-row-group">
      <Message align={outgoing ? "end" : "start"} className={`message-row${outgoing ? " message-row--outgoing" : ""}`}>
        <MessageAvatar className="message-avatar" aria-hidden="true">{avatarInitial}</MessageAvatar>
        <MessageContent className="message-row-content">
          <article className={`message-bubble${outgoing ? " message-bubble--outgoing" : ""}`}>
            <p>{body}</p>
          </article>
          <MessageFooter className={`message-time${outgoing ? " message-time--outgoing" : ""}`}>
            <time>{time}</time>
            {outgoing && deliveryStatus && (
              <span className={`message-delivery-status${deliveryStatus === "failed" ? " message-delivery-status--failed" : ""}`}>
                {deliveryStatus === "accepted" ? "Sending" : `${deliveryStatus[0].toUpperCase()}${deliveryStatus.slice(1)}`}
              </span>
            )}
            <button className="message-copy-action" type="button" onClick={copyMessage} aria-label={copied ? "Message copied" : "Copy message"} title={copied ? "Copied" : "Copy message"}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </MessageFooter>
        </MessageContent>
      </Message>
    </MessageGroup>
  );
}
