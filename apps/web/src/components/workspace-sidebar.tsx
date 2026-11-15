"use client";

import {
  BookOpenText,
  Boxes,
  CircleHelp,
  LayoutDashboard,
  MessageSquareText,
  Plug,
  Settings2,
  ShoppingBag,
  Users,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type WorkspaceSection = "overview" | "inbox" | "orders";

const navigation = [
  { label: "Overview", href: "/", icon: LayoutDashboard, key: "overview" },
  { label: "Inbox", href: "/inbox", icon: MessageSquareText, key: "inbox" },
  { label: "Orders", href: "/orders", icon: ShoppingBag, key: "orders" },
] as const;

const comingSoon = [
  { label: "Catalog", icon: Boxes },
  { label: "Knowledge", icon: BookOpenText },
  { label: "Channels", icon: Plug },
  { label: "Team", icon: Users },
  { label: "Settings", icon: Settings2 },
];

const SIDEBAR_STORAGE_KEY = "workspace-sidebar-collapsed-v2";

function subscribeToSidebarPreference(onChange: () => void) {
  const handleStorage = () => onChange();
  window.addEventListener("storage", handleStorage);
  window.addEventListener("workspace-sidebar-change", handleStorage);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("workspace-sidebar-change", handleStorage);
  };
}

function getSidebarPreference() {
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
}

export function WorkspaceSidebar({ active }: { active: WorkspaceSection }) {
  const collapsed = useSyncExternalStore(subscribeToSidebarPreference, getSidebarPreference, () => false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const focusSearchOnExpand = useRef(false);

  useEffect(() => {
    document.body.dataset.sidebarCollapsed = String(collapsed);
  }, [collapsed]);

  useEffect(() => {
    if (!collapsed && focusSearchOnExpand.current) {
      searchInputRef.current?.focus();
      focusSearchOnExpand.current = false;
    }
  }, [collapsed]);

  const openSearch = useCallback(() => {
    if (collapsed) {
      focusSearchOnExpand.current = true;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "false");
      window.dispatchEvent(new Event("workspace-sidebar-change"));
      return;
    }

    searchInputRef.current?.focus();
  }, [collapsed]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [openSearch]);

  function toggleSidebar() {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!collapsed));
    window.dispatchEvent(new Event("workspace-sidebar-change"));
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredNavigation = navigation.filter(({ label }) => label.toLowerCase().includes(normalizedQuery));
  const filteredComingSoon = comingSoon.filter(({ label }) => label.toLowerCase().includes(normalizedQuery));

  return (
    <aside className={`sidebar${collapsed ? " sidebar--collapsed" : ""}`} aria-label="Main navigation">
      <div className="sidebar-head">
        <Link className="brand" href="/" aria-label="Sales Assistant home">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span className="brand-name">Sales Assistant</span>
        </Link>
        <button className="sidebar-toggle" type="button" onClick={toggleSidebar} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
        {collapsed && <button className="sidebar-search" type="button" onClick={openSearch} aria-label="Search" title="Search"><Search size={17} /></button>}
      </div>

      <div className="sidebar-search-field">
        <Search className="sidebar-search-field-icon" size={16} aria-hidden="true" />
        <input
          ref={searchInputRef}
          className="sidebar-search-input"
          type="search"
          placeholder="Search"
          aria-label="Search workspace navigation"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <kbd className="sidebar-shortcut"><span>Ctrl</span><span>K</span></kbd>
      </div>

      {filteredNavigation.length > 0 && <div className="nav-label">Workspace</div>}
      {filteredNavigation.length > 0 && <nav className="nav-list" aria-label="Workspace">
        {filteredNavigation.map(({ label, href, icon: Icon, key }) => (
          <Link className={`nav-item${active === key ? " nav-item--active" : ""}`} href={href} key={key} aria-current={active === key ? "page" : undefined} title={collapsed ? label : undefined}>
            <Icon className="nav-icon" size={17} strokeWidth={1.8} /><span className="nav-item-label">{label}</span>
          </Link>
        ))}
      </nav>}

      {filteredComingSoon.length > 0 && <div className="nav-label nav-label--business">Business</div>}
      {filteredComingSoon.length > 0 && <nav className="nav-list" aria-label="Business management">
        {filteredComingSoon.map(({ label, icon: Icon }) => (
          <span className="nav-item nav-item--disabled" key={label} aria-disabled="true" title={collapsed ? `${label} — coming soon` : undefined}>
            <Icon className="nav-icon" size={17} strokeWidth={1.8} />
            <span>{label}</span><span className="nav-soon">Soon</span>
          </span>
        ))}
      </nav>}
      {normalizedQuery && filteredNavigation.length === 0 && filteredComingSoon.length === 0 && <p className="sidebar-search-empty">No matches</p>}

      <div className="sidebar-bottom">
        <Link className="help-card" href="/#setup-title" title={collapsed ? "Need a hand? Follow the setup checklist." : undefined}>
          <span className="help-icon"><CircleHelp size={15} /></span>
          <span><strong>Need a hand?</strong><span className="help-copy">Follow the setup checklist to prepare your assistant.</span></span>
        </Link>
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredNavigation = navigation.filter(({ label }) => label.toLowerCase().includes(normalizedQuery));
  const filteredComingSoon = comingSoon.filter(({ label }) => label.toLowerCase().includes(normalizedQuery));

  return (
    <header className="mobile-bar">
      <Link className="mobile-brand" href="/">
        <span className="brand-mark" aria-hidden="true">S</span>
        <span>Sales Assistant</span>
      </Link>
      <div className="mobile-actions">
        <button className="mobile-search-toggle" type="button" aria-label="Search navigation" aria-expanded={searchOpen} aria-controls="mobile-workspace-menu" onClick={() => { setMenuOpen(true); setSearchOpen(true); }}>
          <Search size={19} />
        </button>
        <button className="mobile-menu-toggle" type="button" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} aria-controls="mobile-workspace-menu" onClick={() => { setMenuOpen((open) => !open); setSearchOpen(false); setSearchQuery(""); }}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {menuOpen && (
        <nav className="mobile-menu" id="mobile-workspace-menu" aria-label="Main navigation">
          {searchOpen && (
            <div className="mobile-menu-search">
              <Search size={16} aria-hidden="true" />
              <input ref={searchInputRef} type="search" placeholder="Search" aria-label="Search navigation" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
            </div>
          )}
          {filteredNavigation.length > 0 && <div className="mobile-menu-label">Workspace</div>}
          {filteredNavigation.map(({ label, href, icon: Icon, key }) => (
            <Link className={`mobile-menu-item${title.toLowerCase() === key ? " mobile-menu-item--active" : ""}`} href={href} key={key} aria-current={title.toLowerCase() === key ? "page" : undefined} onClick={() => setMenuOpen(false)}>
              <Icon size={17} strokeWidth={1.8} />{label}
            </Link>
          ))}
          {filteredComingSoon.length > 0 && <div className="mobile-menu-label mobile-menu-label--business">Business</div>}
          {filteredComingSoon.map(({ label, icon: Icon }) => (
            <span className="mobile-menu-item mobile-menu-item--disabled" key={label} aria-disabled="true">
              <Icon size={17} strokeWidth={1.8} />{label}<span className="mobile-menu-soon">Soon</span>
            </span>
          ))}
          {normalizedQuery && filteredNavigation.length === 0 && filteredComingSoon.length === 0 && <p className="mobile-menu-empty">No matches</p>}
        </nav>
      )}
    </header>
  );
}
