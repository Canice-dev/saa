import {
  ArrowLeft,
  Info,
  MessageSquareText,
  Search,
} from "lucide-react";
import { asc, desc, eq, sql } from "drizzle-orm";
import { connection } from "next/server";
import Link from "next/link";
import { MobileWorkspaceBar, WorkspaceSidebar } from "@/components/workspace-sidebar";
import { InboxMessage } from "@/components/inbox-message";
import { InboxReplyComposer } from "@/components/inbox-reply-composer";
import { InboxMessageScroller } from "@/components/inbox-message-scroller";
import { InboxAutoRefresh } from "@/components/inbox-auto-refresh";
import { InboxConversationTriage } from "@/components/inbox-conversation-triage";
import { CustomerDetailsDrawer } from "@/components/customer-details-drawer";
import { getDatabase } from "@/lib/db/client";
import { conversations, customers, messages } from "@/lib/db/schema";

type InboxSearchParams = Promise<{ conversation?: string | string[]; q?: string | string[]; status?: string | string[] }>;

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
  if (messageType === "reaction") return "Reacted to a message";
  return `${messageType.charAt(0).toUpperCase()}${messageType.slice(1)} message`;
}

function initials(name: string | null, fallback: string) {
  return (name?.trim() || fallback).slice(0, 1).toUpperCase();
}

function inboxFilterHref(status: string, searchQuery: string) {
  const query = new URLSearchParams();
  if (status !== "open") query.set("status", status);
  if (searchQuery) query.set("q", searchQuery);
  const value = query.toString();
  return value ? `/inbox?${value}` : "/inbox";
}

function inboxConversationHref(conversationId: string, status: string, searchQuery: string) {
  const query = new URLSearchParams({ conversation: conversationId });
  if (status !== "open") query.set("status", status);
  if (searchQuery) query.set("q", searchQuery);
  return `/inbox?${query.toString()}`;
}

export default async function InboxPage({ searchParams }: { searchParams: InboxSearchParams }) {
  await connection();
  const params = await searchParams;
  const requestedId = Array.isArray(params.conversation) ? params.conversation[0] : params.conversation;
  const searchQuery = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() ?? "";
  const requestedStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const statusFilter = requestedStatus === "all" || requestedStatus === "closed" ? requestedStatus : "open";

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
    unreadCount: number;
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
        unreadCount: sql<number>`(
          select count(*)::int
          from ${messages}
          where ${messages.conversationId} = ${conversations.id}
            and ${messages.direction} = 'inbound'
            and ${messages.receivedAt} > coalesce(${conversations.lastReadAt}, '-infinity'::timestamptz)
        )`,
      })
      .from(conversations)
      .innerJoin(customers, eq(conversations.customerId, customers.id))
      .orderBy(desc(conversations.updatedAt))
      .limit(100);
  } catch {
    inboxError = true;
  }

  const statusItems = statusFilter === "all"
    ? inboxItems
    : inboxItems.filter((item) => item.state === statusFilter);
  const visibleItems = searchQuery
    ? statusItems.filter((item) => `${item.customerName ?? ""} ${item.externalUserId} ${item.phoneNumber ?? ""} ${item.channel}`.toLowerCase().includes(searchQuery.toLowerCase()))
    : statusItems;
  const openCount = inboxItems.filter((item) => item.state === "open").length;
  const resolvedCount = inboxItems.filter((item) => item.state === "closed").length;
  const activeConversation = visibleItems.find((item) => item.id === requestedId) ?? visibleItems[0];
  const requestedConversationIsVisible = Boolean(requestedId && visibleItems.some((item) => item.id === requestedId));
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

  const mostRecentCustomerMessage = [...thread].reverse().find((message) => message.senderRole === "customer");
  const lastCustomerMessageAt = mostRecentCustomerMessage?.createdAt
    ? new Date(mostRecentCustomerMessage.createdAt).getTime()
    : null;
  const now = Date.now();
  const replyWindowOpen = lastCustomerMessageAt !== null &&
    now - lastCustomerMessageAt >= 0 &&
    now - lastCustomerMessageAt < 24 * 60 * 60 * 1000;
  const replyUnavailableReason = threadError
    ? "Couldn’t verify the WhatsApp reply window. Refresh before sending."
    : activeConversation?.channel !== "whatsapp"
      ? "Replies are currently available for WhatsApp only."
      : !process.env.WHATSAPP_PHONE_NUMBER_ID || !process.env.WHATSAPP_ACCESS_TOKEN
        ? "Connect WhatsApp to enable replies."
        : !replyWindowOpen
          ? "The 24-hour reply window has expired. An approved WhatsApp template is required to message this customer."
          : undefined;

  return (
    <main className="app-shell" id="inbox">
      <InboxAutoRefresh />
      <WorkspaceSidebar active="inbox" />
      <section className="main-panel inbox-main-panel">
        <MobileWorkspaceBar title="Inbox" />
        <div className="page-content inbox-page-content">
          {inboxError ? (
            <section className="inbox-notice" role="status"><strong>Couldn’t load conversations.</strong><p>Check that the database is configured and migrations have been applied, then refresh.</p></section>
          ) : (
            <section className={`inbox-layout${requestedConversationIsVisible ? " inbox-layout--mobile-thread" : " inbox-layout--mobile-list"}`} aria-label="Customer inbox">
              <aside className="conversation-list panel" aria-label="Conversation list">
                <div className="conversation-list-heading"><div><h1>Chats</h1><span>{visibleItems.length} conversations</span></div></div>
                <nav className="inbox-filter-tabs" aria-label="Conversation status filters">
                  <Link className={`inbox-filter-tab${statusFilter === "open" ? " inbox-filter-tab--active" : ""}`} href={inboxFilterHref("open", searchQuery)} aria-current={statusFilter === "open" ? "page" : undefined}>Open <span>{openCount}</span></Link>
                  <Link className={`inbox-filter-tab${statusFilter === "closed" ? " inbox-filter-tab--active" : ""}`} href={inboxFilterHref("closed", searchQuery)} aria-current={statusFilter === "closed" ? "page" : undefined}>Resolved <span>{resolvedCount}</span></Link>
                  <Link className={`inbox-filter-tab${statusFilter === "all" ? " inbox-filter-tab--active" : ""}`} href={inboxFilterHref("all", searchQuery)} aria-current={statusFilter === "all" ? "page" : undefined}>All</Link>
                </nav>
                <form className="conversation-search" action="/inbox" role="search">
                  <input type="hidden" name="status" value={statusFilter} />
                  <Search size={16} aria-hidden="true" />
                  <input type="search" name="q" placeholder="Search or start a new chat" defaultValue={searchQuery} aria-label="Search conversations" />
                </form>
                {visibleItems.length === 0 ? (
                  <div className="inbox-empty-list"><span className="inbox-empty-icon"><MessageSquareText size={18} /></span><h3>{searchQuery ? "No chats found" : inboxItems.length === 0 ? "No conversations yet" : statusFilter === "open" ? "No open conversations" : statusFilter === "closed" ? "No resolved conversations" : "No conversations found"}</h3><p>{searchQuery ? "Try a different name, number, or channel." : inboxItems.length === 0 ? "When a customer message reaches your channel, it will appear here." : "Switch status filters to find another conversation."}</p></div>
                ) : (
                  <div className="conversation-items">
                    {visibleItems.map((item) => {
                      const selected = activeConversation?.id === item.id;
                      return (
                        <Link className={`conversation-item${selected ? " conversation-item--selected" : ""}`} href={inboxConversationHref(item.id, statusFilter, searchQuery)} key={item.id} aria-current={selected ? "page" : undefined}>
                          <span className="customer-avatar" aria-hidden="true">{initials(item.customerName, item.externalUserId)}</span>
                          <span className={`conversation-item-copy${item.unreadCount > 0 ? " conversation-item-copy--unread" : ""}`}>
                            <span className="conversation-item-top"><strong>{item.customerName || item.externalUserId}</strong><time>{formatTime(item.lastMessageAt ?? item.updatedAt, true)}</time></span>
                            <span className="conversation-item-bottom">
                              <span className="conversation-item-preview">{previewText(item.lastMessageBody, item.lastMessageType)}</span>
                              {item.unreadCount > 0 && <span className="conversation-unread-badge" aria-label={`${item.unreadCount} unread message${item.unreadCount === 1 ? "" : "s"}`}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</span>}
                            </span>
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
                      <Link className="thread-back" href="/inbox" aria-label="Back to chats"><ArrowLeft size={19} /></Link>
                      <span className="customer-avatar customer-avatar--large" aria-hidden="true">{initials(activeConversation.customerName, activeConversation.externalUserId)}</span>
                      <span className="thread-customer"><strong>{activeConversation.customerName || activeConversation.externalUserId}</strong></span>
                      <InboxConversationTriage conversationId={activeConversation.id} messageCount={thread.length} state={activeConversation.state} />
                      <CustomerDetailsDrawer
                        avatarInitial={initials(activeConversation.customerName, activeConversation.externalUserId)}
                        automationPaused={activeConversation.automationPaused}
                        channel={activeConversation.channel === "whatsapp" ? "WhatsApp" : activeConversation.channel}
                        externalUserId={activeConversation.externalUserId}
                        lastActive={formatTime(activeConversation.updatedAt, true)}
                        name={activeConversation.customerName || "WhatsApp customer"}
                        phoneNumber={activeConversation.phoneNumber}
                        replyMode={activeConversation.state}
                      />
                    </header>
                    <div className="thread-notice"><Info size={14} /> Seller replies go through WhatsApp. Automatic replies remain paused.</div>
                    <InboxMessageScroller key={activeConversation.id} messageCount={thread.length}>
                      {threadError ? <div className="thread-empty"><p>Couldn’t load messages. Refresh to try again.</p></div> : thread.length === 0 ? <div className="thread-empty"><p>No messages are stored for this conversation yet.</p></div> : thread.map((message) => {
                        const outgoing = message.senderRole !== "customer";
                        return (
                          <InboxMessage
                            key={message.id}
                            body={previewText(message.body, message.messageType)}
                            avatarInitial={outgoing ? "S" : initials(activeConversation.customerName, activeConversation.externalUserId)}
                            deliveryStatus={message.deliveryStatus}
                            messageType={message.messageType}
                            outgoing={outgoing}
                            time={formatTime(message.createdAt)}
                          />
                        );
                      })}
                    </InboxMessageScroller>
                    <InboxReplyComposer conversationId={activeConversation.id} disabledReason={replyUnavailableReason} />
                    <div className="thread-footer"><span className="status-dot status-dot--amber" /> Automatic replies are paused while channel handoff is verified.</div>
                  </>
                ) : (
                  <div className="thread-empty thread-empty--welcome"><span className="inbox-empty-icon"><MessageSquareText size={19} /></span><h2>Your conversations will appear here</h2><p>Select a conversation to review its messages and delivery status.</p></div>
                )}
              </section>

            </section>
          )}

        </div>
      </section>
    </main>
  );
}
