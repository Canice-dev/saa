const sections = ["Inbox", "Orders", "Catalog", "Knowledge", "Channels", "Team", "Settings"];

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true">S</span>;
}

function StatusDot({ tone = "muted" }: { tone?: "muted" | "amber" | "green" }) {
  return <span className={`status-dot status-dot--${tone}`} aria-hidden="true" />;
}

export default function Home() {
  return (
    <main className="app-shell" id="overview">
      <aside className="sidebar" aria-label="Main navigation">
        <a className="brand" href="#overview" aria-label="Sales Assistant home">
          <BrandMark />
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
          <a className="nav-item nav-item--active" href="#overview" aria-current="page">
            <span className="nav-icon" aria-hidden="true">◫</span> Overview
          </a>
          {sections.map((section) => section === "Inbox" ? (
            <a className="nav-item" href="/inbox" key={section}>
              <span className="nav-icon" aria-hidden="true">â–¤</span><span>{section}</span>
            </a>
          ) : (
            <span className="nav-item nav-item--disabled" key={section} aria-disabled="true">
              <span className="nav-icon" aria-hidden="true">{section === "Inbox" ? "▤" : section === "Orders" ? "▱" : section === "Catalog" ? "▦" : section === "Knowledge" ? "▧" : section === "Channels" ? "⌁" : section === "Team" ? "♙" : "⚙"}</span>
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
              <p>Your setup guide is coming soon.</p>
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
          <div className="breadcrumbs"><span>Workspace</span><span className="breadcrumb-separator">/</span><strong>Overview</strong></div>
          <div className="topbar-right">
            <span className="environment-pill"><StatusDot /> Setup mode</span>
            <button className="icon-button" type="button" aria-label="Notifications">♧<span className="notification-dot" /></button>
            <span className="topbar-avatar" aria-label="Owner account">O</span>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="date-kicker">YOUR BUSINESS WORKSPACE</p>
              <h1>Good morning<span className="heading-period">.</span></h1>
              <p className="welcome-subtitle">Your Sales Assistant setup starts here.</p>
            </div>
            <a className="primary-button" href="#setup"><span aria-hidden="true">＋</span> Continue setup</a>
          </section>

          <section className="status-banner" aria-label="Agent status">
            <div className="status-banner-icon"><span className="status-ring"><StatusDot tone="amber" /></span></div>
            <div className="status-banner-copy">
              <div className="status-title-row"><h2>Assistant is paused</h2><span className="status-tag">SETUP REQUIRED</span></div>
              <p>Connect and verify your messaging channels before the assistant can respond to customers.</p>
            </div>
            <a className="text-link" href="#setup">View setup steps <span aria-hidden="true">→</span></a>
          </section>

          <section className="metrics-grid" aria-label="Business activity">
            <article className="metric-card">
              <div className="metric-top"><span>Conversations today</span><span className="metric-icon metric-icon--blue">◫</span></div>
              <p className="metric-value">—</p><p className="metric-note">Available after channel connection</p>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span>Waiting for you</span><span className="metric-icon metric-icon--orange">◷</span></div>
              <p className="metric-value">—</p><p className="metric-note">Customer messages needing review</p>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span>Pending orders</span><span className="metric-icon metric-icon--purple">▱</span></div>
              <p className="metric-value">—</p><p className="metric-note">Orders awaiting your approval</p>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span>Assistant replies</span><span className="metric-icon metric-icon--green">✳</span></div>
              <p className="metric-value">—</p><p className="metric-note">Activity appears after launch</p>
            </article>
          </section>

          <div className="content-grid">
            <section className="panel setup-panel" id="setup">
              <div className="panel-heading">
                <div><p className="section-kicker">GET STARTED</p><h2>Set up your assistant</h2></div>
                <span className="progress-count">0 <span>of</span> 4</span>
              </div>
              <div className="progress-track" aria-label="Setup progress: 0 of 4 steps complete"><span /></div>
              <ol className="setup-list">
                <li className="setup-step">
                  <span className="step-number">1</span>
                  <span className="step-copy"><strong>Connect a messaging channel</strong><small>Link an eligible WhatsApp Business or Instagram account.</small></span>
                  <span className="step-state">NOT STARTED</span>
                  <span className="step-arrow" aria-hidden="true">›</span>
                </li>
                <li className="setup-step">
                  <span className="step-number">2</span>
                  <span className="step-copy"><strong>Add your products</strong><small>Enter products or prepare a catalog spreadsheet.</small></span>
                  <span className="step-state">NOT STARTED</span>
                  <span className="step-arrow" aria-hidden="true">›</span>
                </li>
                <li className="setup-step">
                  <span className="step-number">3</span>
                  <span className="step-copy"><strong>Add store information</strong><small>Share delivery, returns, and other approved policies.</small></span>
                  <span className="step-state">NOT STARTED</span>
                  <span className="step-arrow" aria-hidden="true">›</span>
                </li>
                <li className="setup-step">
                  <span className="step-number">4</span>
                  <span className="step-copy"><strong>Review and enable replies</strong><small>Test the seller handoff and choose your reply settings.</small></span>
                  <span className="step-state">NOT STARTED</span>
                  <span className="step-arrow" aria-hidden="true">›</span>
                </li>
              </ol>
              <p className="setup-footnote"><span aria-hidden="true">ⓘ</span> The assistant stays paused until channel reply detection is verified.</p>
            </section>

            <section className="panel activity-panel">
              <div className="panel-heading">
                <div><p className="section-kicker">LIVE WORKSPACE</p><h2>Recent activity</h2></div>
                <span className="live-label"><StatusDot /> LIVE</span>
              </div>
              <div className="empty-activity">
                <div className="empty-illustration" aria-hidden="true"><span className="empty-bubble empty-bubble--back">···</span><span className="empty-bubble empty-bubble--front">✳</span></div>
                <h3>It’s quiet for now</h3>
                <p>Once setup is complete, customer conversations and assistant actions will show up here.</p>
              </div>
              <div className="activity-footer"><span><StatusDot /> All systems waiting for setup</span></div>
            </section>
          </div>

          <footer className="page-footer"><span>Sales Assistant</span><span>One business. One private workspace.</span><span>Help center&nbsp; · &nbsp;Privacy</span></footer>
        </div>
      </section>
    </main>
  );
}
