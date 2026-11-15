"use client";

import { useState } from "react";
import { ArrowDownUp, ClipboardList, Search, SlidersHorizontal } from "lucide-react";
import { MobileWorkspaceBar, WorkspaceSidebar } from "@/components/workspace-sidebar";
import { Button } from "@/components/ui/button";

const orderStatuses = ["All orders", "Needs review", "Approved", "Cancelled"];

export default function OrdersPage() {
  const [activeStatus, setActiveStatus] = useState(orderStatuses[0]);

  return (
    <main className="app-shell" id="orders">
      <WorkspaceSidebar active="orders" />
      <section className="main-panel orders-main-panel">
        <MobileWorkspaceBar title="Orders" />
        <div className="page-content orders-page-content">
          <header className="orders-heading">
            <div>
              <p className="date-kicker">Business</p>
              <h1>Orders<span className="heading-period">.</span></h1>
              <p className="welcome-subtitle">Review and manage the orders customers place through your channels.</p>
            </div>
            <span className="orders-count"><ClipboardList size={16} /> 0 orders</span>
          </header>

          <section className="orders-workspace" aria-label="Orders workspace">
            <div className="orders-list-panel">
              <div className="orders-list-heading">
                <div><h2>Orders</h2><span>Keep track of customer purchases</span></div>
                <Button variant="outline" size="icon" aria-label="Order filters" disabled title="Filters will be available when orders are connected"><SlidersHorizontal size={16} /></Button>
              </div>
              <div className="orders-tabs" role="tablist" aria-label="Order status">
                {orderStatuses.map((status, index) => (
                  <button className={`orders-tab${activeStatus === status ? " orders-tab--active" : ""}`} type="button" role="tab" aria-selected={activeStatus === status} onClick={() => setActiveStatus(status)} key={status}>
                    {status}{index === 0 && <span className="orders-tab-count">0</span>}
                  </button>
                ))}
              </div>
              <label className="orders-search"><Search size={16} aria-hidden="true" /><input type="search" placeholder="Search orders" aria-label="Search orders" disabled /></label>
              <div className="orders-empty-list">
                <span className="orders-empty-icon"><ClipboardList size={19} /></span>
                <h3>{activeStatus === "All orders" ? "No orders yet" : `No ${activeStatus.toLowerCase()} orders`}</h3>
                <p>Customer orders will appear here when they come in through your connected channels.</p>
              </div>
            </div>

            <section className="orders-detail-panel" aria-label="Order details">
              <div className="orders-detail-empty">
                <span className="orders-detail-icon"><ArrowDownUp size={19} /></span>
                <h2>Your order activity, in one place</h2>
                <p>Orders that need your review will be listed here. Select an order to check its items and decide what happens next.</p>
              </div>
            </section>
          </section>
        </div>
      </section>
    </main>
  );
}
