import {
  ArrowRight,
  BookOpenText,
  Check,
  CircleHelp,
  Clock3,
  MessageSquareText,
  Plug,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { MobileWorkspaceBar, WorkspaceSidebar } from "@/components/workspace-sidebar";

const setupSteps = [
  { title: "Connect a messaging channel", detail: "Link WhatsApp Business or Instagram to receive customer messages.", icon: Plug },
  { title: "Add your products", detail: "Give the assistant accurate product names, prices, and stock details.", icon: ShoppingBag },
  { title: "Add store information", detail: "Include delivery, returns, opening hours, and payment instructions.", icon: BookOpenText },
  { title: "Test before enabling replies", detail: "Check answers and seller handoff before turning on automation.", icon: ShieldCheck },
];

const metrics = [
  { label: "Conversations", value: "—", note: "Available after channel connection", icon: MessageSquareText, tone: "blue" },
  { label: "Needs your attention", value: "—", note: "Questions waiting for review", icon: CircleHelp, tone: "gray" },
  { label: "Orders in review", value: "—", note: "Drafts awaiting your approval", icon: ShoppingBag, tone: "purple" },
  { label: "Setup complete", value: "0 of 4", note: "Get ready to assist customers", icon: Check, tone: "green" },
];

export default function Home() {
  return (
    <main className="app-shell" id="overview">
      <WorkspaceSidebar active="overview" />
      <section className="main-panel">
        <MobileWorkspaceBar title="Overview" />
        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="date-kicker">Your business workspace</p>
              <h1>Overview<span className="heading-period">.</span></h1>
              <p className="welcome-subtitle">Set up your assistant and keep every customer conversation in view.</p>
            </div>
            <Link className="primary-button" href="/inbox"><MessageSquareText size={16} /> Open inbox<ArrowRight size={15} /></Link>
          </section>

          <section className="status-banner" aria-label="Assistant status">
            <div className="status-banner-icon"><span className="status-ring"><span className="status-dot status-dot--amber" /></span></div>
            <div className="status-banner-copy">
              <div className="status-title-row"><h2>Automatic replies are paused</h2><span className="status-tag">Setup mode</span></div>
              <p>Customer messages can reach your inbox while you connect a channel and test seller handoff.</p>
            </div>
              <Link className="text-link" href="/inbox">Review inbox<ArrowRight size={14} /></Link>
          </section>

          <section className="metrics-grid" aria-label="Workspace summary">
            {metrics.map(({ label, value, note, icon: Icon, tone }) => (
              <article className="metric-card" key={label}>
                <div className="metric-top"><span>{label}</span><span className={`metric-icon metric-icon--${tone}`}><Icon size={15} strokeWidth={1.8} /></span></div>
                <p className="metric-value">{value}</p>
                <p className="metric-note">{note}</p>
              </article>
            ))}
          </section>

          <div className="content-grid">
            <section className="panel setup-panel" aria-labelledby="setup-title">
              <div className="panel-heading">
                <div><p className="section-kicker">A short setup, safer replies</p><h2 id="setup-title">Get your workspace ready</h2></div>
                <span className="progress-count">0 <span>of 4 complete</span></span>
              </div>
              <div className="progress-track" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={4} aria-valuenow={0}><span /></div>
              <ol className="setup-list">
                {setupSteps.map(({ title, detail, icon: Icon }, index) => (
                  <li className="setup-step" key={title}>
                    <span className="step-number">{index + 1}</span>
                    <span className="step-copy"><strong>{title}</strong><small>{detail}</small></span>
                    <Icon className="step-icon" size={16} strokeWidth={1.8} aria-hidden="true" />
                    {index === 0 && <Link className="step-link" href="/inbox" aria-label="Review inbox for channel setup"><ArrowRight size={15} /></Link>}
                  </li>
                ))}
              </ol>
              <p className="setup-footnote"><Clock3 size={14} /> Replies stay paused until the channel and seller handoff are verified.</p>
            </section>

            <section className="panel activity-panel" aria-labelledby="activity-title">
              <div className="panel-heading">
                <div><p className="section-kicker">Workspace</p><h2 id="activity-title">Recent activity</h2></div>
                <span className="live-label">Waiting for setup</span>
              </div>
              <div className="empty-activity">
                <div className="empty-illustration" aria-hidden="true"><span className="empty-bubble empty-bubble--back">···</span><span className="empty-bubble empty-bubble--front"><MessageSquareText size={19} /></span></div>
                <h3>It’s quiet for now</h3>
                <p>Once a channel is connected, customer conversations and assistant actions will appear here.</p>
              </div>
              <div className="activity-footer"><span><span className="status-dot status-dot--amber" /> Waiting for a channel connection</span></div>
            </section>
          </div>

          <footer className="page-footer"><span>Sales Assistant</span><span>One business. One private workspace.</span><span>Help with setup&nbsp; · &nbsp;Privacy</span></footer>
        </div>
      </section>
    </main>
  );
}
