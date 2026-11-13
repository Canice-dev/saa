import {
  ArrowRight,
  CheckCheck,
  FileText,
  Info,
  MessageSquareText,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { asc, desc, eq, sql } from "drizzle-orm";
import { connection } from "next/server";
import Link from "next/link";
import { MobileWorkspaceBar, WorkspaceSidebar } from "@/components/workspace-sidebar";
import { getDatabase } from "@/lib/db/client";
import { conversations, customers, messages } from "@/lib/db/schema";

type InboxSearchParams = Promise<{ conversation?: string | string[] }>;

function formatTime(value: Date | string | null, withDate = false) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    ...(withDate ? { day: "numeric" as const, month: "short" as const } : {}),
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function previewText(body: string | null, messageType: string | null) {
  if (body) return body;
  if (!messageType) return "No messages yet";
  return `${messageType.charAt(0).toUpperCase()}${messageType.slice(1)} message`;
}

function initials(name: string | null, fallback: string) {
  return (name?.trim() || fallback).slice(0, 1).toUpperCase();
}

export default async function InboxPage({ searchParams }: { searchParams: InboxSearchParams }) {
  await connection();
  const params = await searchParams;
  const requestedId = Array.isArray(params.conversation) ? params.conversation[0] : params.conversation;

  let inboxItems: {
    id: string;
    channel: string;
    state: string;
    automationPaused: boolean;
    updatedAt: Date;
    customerName: string | null;
    externalUserId: string;
    phoneNumber: string | null;
    lastMessageBody: string | null;
    lastMessageType: string | null;
    lastMessageAt: Date | null;
  }[] = [];
  let inboxError = false;

  try {
    const db = getDatabase();
    inboxItems = await db
      .select({
        id: conversations.id,
        channel: conversations.channel,
        state: conversations.state,
        automationPaused: conversations.automationPaused,
        updatedAt: conversations.updatedAt,
        customerName: customers.displayName,
        externalUserId: customers.externalUserId,
        phoneNumber: customers.phoneNumber,
        lastMessageBody: sql<string | null>`(
          select ${messages.body}
          from ${messages}
          where ${messages.conversationId} = ${conversations.id}
          order by ${messages.receivedAt} desc
          limit 1
        )`,
        lastMessageType: sql<string | null>`(
          select ${messages.messageType}
          from ${messages}
          where ${messages.conversationId} = ${conversations.id}
          order by ${messages.receivedAt} desc
          limit 1
        )`,
        lastMessageAt: sql<Date | null>`(
          select coalesce(${messages.providerTimestamp}, ${messages.receivedAt})
          from ${messages}
          where ${messages.conversationId} = ${conversations.id}
          order by ${messages.receivedAt} desc
          limit 1
        )`,
      })
      .from(conversations)
      .innerJoin(customers, eq(conversations.customerId, customers.id))
      .orderBy(desc(conversations.updatedAt))
      .limit(100);
  } catch {
    inboxError = true;
  }

  const activeConversation = inboxItems.find((item) => item.id === requestedId) ?? inboxItems[0];
  let thread: {
    id: string;
    senderRole: string;
    messageType: string;
    body: string | null;
    createdAt: Date;
    deliveryStatus: string | null;
  }[] = [];
  let threadError = false;

  if (activeConversation) {
    try {
      thread = await getDatabase()
        .select({
          id: messages.id,
          senderRole: messages.senderRole,
          messageType: messages.messageType,
          body: messages.body,
          createdAt: sql<Date>`coalesce(${messages.providerTimestamp}, ${messages.receivedAt})`,
          deliveryStatus: messages.deliveryStatus,
        })
        .from(messages)
        .where(eq(messages.conversationId, activeConversation.id))
        .orderBy(asc(messages.receivedAt))
        .limit(200);
    } catch {
      threadError = true;
    }
  }

  return (
    <main className="app-shell" id="inbox">
      <WorkspaceSidebar active="inbox" />
      <section className="main-panel">
        <MobileWorkspaceBar title="Inbox" />
        <div className="page-content inbox-page-content">
          <section className="welcome-row inbox-welcome">
            <div><p className="date-kicker">Customer messages</p><h1>Inbox<span className="heading-period">.</span></h1><p className="welcome-subtitle">Review conversations and keep your team in control.</p></div>
            <Link className="secondary-button" href="/inbox">Refresh inbox<ArrowRight size={14} /></Link>
          </section>

          {inboxError ? (
            <section className="inbox-notice" role="status"><strong>Couldn’t load conversations.</strong><p>Check that the database is configured and migrations have been applied, then refresh.</p></section>
          ) : (
            <section className="inbox-layout" aria-label="Customer inbox">
              <aside className="conversation-list panel" aria-label="Conversation list">
                <div className="conversation-list-heading"><div><p className="section-kicker">All channels</p><h2>Conversations</h2></div><span className="conversation-count">{inboxItems.length}</span></div>
                {inboxItems.length === 0 ? (
                  <div className="inbox-empty-list"><span className="inbox-empty-icon"><MessageSquareText size={18} /></span><h3>No conversations yet</h3><p>When a customer message reaches your channel, it will appear here.</p></div>
                ) : (
                  <div className="conversation-items">
                    {inboxItems.map((item) => {
                      const selected = activeConversation?.id === item.id;
                      return (
                        <Link className={`conversation-item${selected ? " conversation-item--selected" : ""}`} href={`/inbox?conversation=${encodeURIComponent(item.id)}`} key={item.id} aria-current={selected ? "page" : undefined}>
                          <span className="customer-avatar" aria-hidden="true">{initials(item.customerName, item.externalUserId)}</span>
                          <span className="conversation-item-copy">
                            <span className="conversation-item-top"><strong>{item.customerName || item.externalUserId}</strong><time>{formatTime(item.lastMessageAt ?? item.updatedAt, true)}</time></span>
                            <span className="conversation-item-preview">{previewText(item.lastMessageBody, item.lastMessageType)}</span>
                            <span className="conversation-item-meta">{item.channel === "whatsapp" ? "WhatsApp" : item.channel} · {item.automationPaused ? "Paused" : item.state}</span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </aside>

              <section className="conversation-thread panel" aria-label="Selected conversation">
                {activeConversation ? (
                  <>
                    <header className="thread-header">
                      <span className="customer-avatar customer-avatar--large" aria-hidden="true">{initials(activeConversation.customerName, activeConversation.externalUserId)}</span>
                      <span className="thread-customer"><strong>{activeConversation.customerName || activeConversation.externalUserId}</strong><small>{activeConversation.channel === "whatsapp" ? "WhatsApp" : activeConversation.channel} · {activeConversation.externalUserId}</small></span>
                      <span className={`thread-state${activeConversation.automationPaused ? " thread-state--paused" : ""}`}>{activeConversation.automationPaused ? "Paused" : activeConversation.state}</span>
                    </header>
                    <div className="thread-notice"><Info size={14} /> Messages are read-only while you complete setup.</div>
                    <div className="thread-messages" aria-label="Messages in this conversation">
                      {threadError ? <div className="thread-empty"><p>Couldn’t load messages. Refresh to try again.</p></div> : thread.length === 0 ? <div className="thread-empty"><p>No messages are stored for this conversation yet.</p></div> : thread.map((message) => {
                        const outgoing = message.senderRole !== "customer";
                        const sender = message.senderRole === "assistant" ? "Assistant" : message.senderRole === "seller" ? "Your business" : "Customer";
                        return (
                          <article className={`message-bubble message-bubble--${message.senderRole}`} key={message.id}>
                            <span className="message-sender">{sender}</span>
                            <p>{previewText(message.body, message.messageType)}</p>
                            <span>{formatTime(message.createdAt)}{outgoing && message.deliveryStatus ? ` · ${message.deliveryStatus}` : ""}</span>
                            {outgoing && message.deliveryStatus && <CheckCheck className="message-check" size={13} aria-label={message.deliveryStatus} />}
                          </article>
                        );
                      })}
                    </div>
                    <div className="thread-footer"><span className="status-dot status-dot--amber" /> Automatic replies are paused while channel handoff is verified.</div>
                  </>
                ) : (
                  <div className="thread-empty thread-empty--welcome"><span className="inbox-empty-icon"><MessageSquareText size={19} /></span><h2>Your conversations will appear here</h2><p>Select a conversation to review its messages and delivery status.</p></div>
                )}
              </section>

              <aside className="customer-details panel" aria-label="Customer details">
                {activeConversation ? (
                  <>
                    <div className="customer-details-heading">Customer details</div>
                    <div className="customer-profile"><span className="customer-avatar" aria-hidden="true">{initials(activeConversation.customerName, activeConversation.externalUserId)}</span><strong>{activeConversation.customerName || "WhatsApp customer"}</strong><small>{activeConversation.phoneNumber || activeConversation.externalUserId}</small></div>
                    <div className="details-block">
                      <h3>Conversation</h3>
                      <div className="details-row"><span>Channel</span><strong>{activeConversation.channel === "whatsapp" ? "WhatsApp" : activeConversation.channel}</strong></div>
                      <div className="details-row"><span>Last active</span><strong>{formatTime(activeConversation.updatedAt, true)}</strong></div>
                      <div className="details-row"><span>Reply mode</span><strong>{activeConversation.automationPaused ? "Paused" : activeConversation.state}</strong></div>
                    </div>
                    <div className="details-block"><h3>Order overview</h3><div className="details-row"><span>Linked orders</span><strong>None yet</strong></div></div>
                    <div className="details-note"><ShieldCheck size={15} /> The seller stays in control while automatic replies are paused.</div>
                    <div className="details-row details-contact"><Phone size={13} /><span>{activeConversation.phoneNumber || "No phone number on file"}</span></div>
                  </>
                ) : <div className="thread-empty"><FileText size={18} /><p>Select a conversation to see customer details.</p></div>}
              </aside>
            </section>
          )}

          <footer className="page-footer"><span>Sales Assistant</span><span>One business. One private workspace.</span><span>Inbox messages are read-only</span></footer>
        </div>
      </section>
    </main>
  );
}
