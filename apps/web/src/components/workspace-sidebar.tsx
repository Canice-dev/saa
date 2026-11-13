import {
  BookOpenText,
  Boxes,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  MessageSquareText,
  Plug,
  Settings2,
  ShoppingBag,
  Users,
} from "lucide-react";

type WorkspaceSection = "overview" | "inbox";

const navigation = [
  { label: "Overview", href: "/", icon: LayoutDashboard, key: "overview" },
  { label: "Inbox", href: "/inbox", icon: MessageSquareText, key: "inbox" },
] as const;

const comingSoon = [
  { label: "Orders", icon: ShoppingBag },
  { label: "Catalog", icon: Boxes },
  { label: "Knowledge", icon: BookOpenText },
  { label: "Channels", icon: Plug },
  { label: "Team", icon: Users },
  { label: "Settings", icon: Settings2 },
];

export function WorkspaceSidebar({ active }: { active: WorkspaceSection }) {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <a className="brand" href="/" aria-label="Sales Assistant home">
        <span className="brand-mark" aria-hidden="true">S</span>
        <span className="brand-name">Sales Assistant</span>
      </a>

      <div className="business-switcher">
        <span className="business-avatar" aria-hidden="true">B</span>
        <span className="business-copy"><span className="eyebrow">Your business</span><span className="business-name">Business workspace</span></span>
        <ChevronDown className="switcher-chevron" size={16} aria-hidden="true" />
      </div>

      <div className="nav-label">Workspace</div>
      <nav className="nav-list" aria-label="Workspace">
        {navigation.map(({ label, href, icon: Icon, key }) => (
          <a className={`nav-item${active === key ? " nav-item--active" : ""}`} href={href} key={key} aria-current={active === key ? "page" : undefined}>
            <Icon className="nav-icon" size={17} strokeWidth={1.8} />{label}
          </a>
        ))}
      </nav>

      <div className="nav-label nav-label--business">Business</div>
      <nav className="nav-list" aria-label="Business management">
        {comingSoon.map(({ label, icon: Icon }) => (
          <span className="nav-item nav-item--disabled" key={label} aria-disabled="true">
            <Icon className="nav-icon" size={17} strokeWidth={1.8} />
            <span>{label}</span><span className="nav-soon">Soon</span>
          </span>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <a className="help-card" href="/#setup-title">
          <span className="help-icon"><CircleHelp size={15} /></span>
          <span><strong>Need a hand?</strong><span className="help-copy">Follow the setup checklist to prepare your assistant.</span></span>
        </a>
        <div className="account-row">
          <span className="account-avatar">O</span>
          <span className="account-copy"><strong>Owner account</strong><small>Business admin</small></span>
          <Settings2 className="account-menu" size={16} aria-hidden="true" />
        </div>
      </div>
    </aside>
  );
}

export function MobileWorkspaceBar({ title }: { title: string }) {
  return (
    <header className="mobile-bar">
      <a className="mobile-brand" href="/">
        <span className="brand-mark" aria-hidden="true">S</span>
        <span>Sales Assistant</span>
      </a>
      <nav className="mobile-nav" aria-label="Workspace">
        <a className={title === "Overview" ? "mobile-nav-link mobile-nav-link--active" : "mobile-nav-link"} href="/" aria-current={title === "Overview" ? "page" : undefined}>Overview</a>
        <a className={title === "Inbox" ? "mobile-nav-link mobile-nav-link--active" : "mobile-nav-link"} href="/inbox" aria-current={title === "Inbox" ? "page" : undefined}>Inbox</a>
      </nav>
    </header>
  );
}
