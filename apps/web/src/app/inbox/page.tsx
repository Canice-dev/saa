import { asc, desc, eq, sql } from "drizzle-orm";
import { connection } from "next/server";
import { getDatabase } from "@/lib/db/client";
import { conversations, customers, messages } from "@/lib/db/schema";

type InboxSearchParams = Promise<{ conversation?: string | string[] }>;

function formatTime(value: Date | string | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  }).format(date);
}

function previewText(body: string | null, messageType: string | null) {
  if (body) return body;
  if (!messageType) return "No messages yet";
  return `${messageType.charAt(0).toUpperCase()}${messageType.slice(1)} message`;
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
    direction: string;
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
          direction: messages.direction,
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
      <aside className="sidebar" aria-label="Main navigation">
        <a className="brand" href="/" aria-label="Sales Assistant home">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span className="brand-name">Sales Assistant</span>
        </a>

        <div className="business-switcher">
          <span className="business-avatar" aria-hidden="true">B</span>
          <span className="business-copy">
            <span className="eyebrow">YOUR BUSINESS</span>
            <span className="business-name">Business setup</span>
          </span>
          <span className="switcher-chevron" aria-hidden="true">⌄</span>
        </div>

        <div className="nav-label">WORKSPACE</div>
        <nav className="nav-list">
          <a className="nav-item" href="/">
            <span className="nav-icon" aria-hidden="true">◫</span> Overview
          </a>
          <a className="nav-item nav-item--active" href="/inbox" aria-current="page">
            <span className="nav-icon" aria-hidden="true">▤</span> Inbox
          </a>
          {["Orders", "Catalog", "Knowledge", "Channels", "Team", "Settings"].map((section) => (
            <span className="nav-item nav-item--disabled" key={section} aria-disabled="true">
              <span className="nav-icon" aria-hidden="true">·</span>
              <span>{section}</span>
              <span className="nav-soon">SOON</span>
            </span>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon" aria-hidden="true">?</span>
            <div>
              <strong>Need a hand?</strong>
              <p>More setup guidance is coming soon.</p>
            </div>
          </div>
          <div className="account-row">
            <span className="account-avatar">O</span>
            <span className="account-copy"><strong>Owner account</strong><small>Business admin</small></span>
            <span className="account-menu" aria-hidden="true">•••</span>
          </div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="breadcrumbs"><a href="/">Workspace</a><span className="breadcrumb-separator">/</span><strong>Inbox</strong></div>
          <div className="topbar-right">
            <span className="environment-pill"><span className="status-dot" /> Setup mode</span>
            <span className="topbar-avatar" aria-label="Owner account">O</span>
          </div>
        </header>

        <div className="page-content inbox-page-content">
          <section className="welcome-row inbox-welcome">
            <div>
              <p className="date-kicker">CUSTOMER MESSAGES</p>
              <h1>Inbox<span className="heading-period">.</span></h1>
              <p className="welcome-subtitle">Review conversations received through your connected channels.</p>
            </div>
            <a className="secondary-button" href="/inbox">Refresh inbox</a>
          </section>

          {inboxError ? (
            <section className="inbox-notice" role="status">
              <strong>Couldn’t load conversations.</strong>
              <p>Check that the database is configured and migrations have been applied, then refresh.</p>
            </section>
          ) : (
            <section className="inbox-layout" aria-label="Customer inbox">
              <div className="conversation-list panel">
                <div className="conversation-list-heading">
                  <div><p className="section-kicker">ALL CHANNELS</p><h2>Conversations</h2></div>
                  <span className="conversation-count">{inboxItems.length}</span>
                </div>
                {inboxItems.length === 0 ? (
                  <div className="inbox-empty-list">
                    <span className="inbox-empty-icon" aria-hidden="true">▤</span>
                    <h3>No conversations yet</h3>
                    <p>When a customer message reaches your webhook, it will appear here.</p>
                  </div>
                ) : (
                  <div className="conversation-items">
                    {inboxItems.map((item) => {
                      const selected = activeConversation?.id === item.id;
                      return (
                        <a
                          className={`conversation-item${selected ? " conversation-item--selected" : ""}`}
                          href={`/inbox?conversation=${encodeURIComponent(item.id)}`}
                          key={item.id}
                          aria-current={selected ? "page" : undefined}
                        >
                          <span className="customer-avatar" aria-hidden="true">{(item.customerName ?? "C").slice(0, 1).toUpperCase()}</span>
                          <span className="conversation-item-copy">
                            <span className="conversation-item-top"><strong>{item.customerName || item.externalUserId}</strong><time>{formatTime(item.lastMessageAt ?? item.updatedAt)}</time></span>
                            <span className="conversation-item-preview">{previewText(item.lastMessageBody, item.lastMessageType)}</span>
                            <span className="conversation-item-meta">{item.channel === "whatsapp" ? "WhatsApp" : item.channel} · {item.automationPaused ? "Paused" : item.state}</span>
                          </span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="conversation-thread panel">
                {activeConversation ? (
                  <>
                    <header className="thread-header">
                      <span className="customer-avatar customer-avatar--large" aria-hidden="true">{(activeConversation.customerName ?? "C").slice(0, 1).toUpperCase()}</span>
                      <span className="thread-customer"><strong>{activeConversation.customerName || activeConversation.externalUserId}</strong><small>{activeConversation.channel === "whatsapp" ? "WhatsApp" : activeConversation.channel} · {activeConversation.externalUserId}</small></span>
                      <span className={`thread-state${activeConversation.automationPaused ? " thread-state--paused" : ""}`}>{activeConversation.automationPaused ? "Paused" : activeConversation.state}</span>
                    </header>
                    <div className="thread-messages" aria-label="Messages in this conversation">
                      {threadError ? (
                        <div className="thread-empty"><p>Couldn’t load messages. Refresh to try again.</p></div>
                      ) : thread.length === 0 ? (
                        <div className="thread-empty"><p>No messages are stored for this conversation yet.</p></div>
                      ) : thread.map((message) => (
                        <article className={`message-bubble message-bubble--${message.senderRole}`} key={message.id}>
                          <p>{previewText(message.body, message.messageType)}</p>
                          <span>{formatTime(message.createdAt)}{message.deliveryStatus ? ` · ${message.deliveryStatus}` : ""}</span>
                        </article>
                      ))}
                    </div>
                    <div className="thread-footer"><span className="status-dot status-dot--amber" /> Replies are paused while channel handoff is being verified.</div>
                  </>
                ) : (
                  <div className="thread-empty thread-empty--welcome">
                    <span className="inbox-empty-icon" aria-hidden="true">◫</span>
                    <h2>Your conversations will appear here</h2>
                    <p>Select a conversation to review its messages and delivery status.</p>
                  </div>
                )}
              </div>
            </section>
          )}

          <footer className="page-footer"><span>Sales Assistant</span><span>One business. One private workspace.</span><span>Inbox data is read-only</span></footer>
        </div>
      </section>
    </main>
  );
}
