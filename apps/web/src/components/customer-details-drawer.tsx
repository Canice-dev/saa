"use client";

import { Info, ShieldCheck, X } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

type CustomerDetailsDrawerProps = {
  avatarInitial: string;
  automationPaused: boolean;
  channel: string;
  externalUserId: string;
  lastActive: string;
  name: string;
  phoneNumber: string | null;
  replyMode: string;
};

export function CustomerDetailsDrawer({
  avatarInitial,
  automationPaused,
  channel,
  externalUserId,
  lastActive,
  name,
  phoneNumber,
  replyMode,
}: CustomerDetailsDrawerProps) {
  return (
    <Drawer swipeDirection="right">
      <DrawerTrigger
        className="thread-details-toggle"
        aria-label="Open customer details"
        title="Customer details"
      >
        <Info size={18} />
      </DrawerTrigger>
      <DrawerContent className="customer-details-drawer-content">
        <DrawerHeader className="customer-details-drawer-header">
          <DrawerTitle>Contact info</DrawerTitle>
          <DrawerClose className="customer-details-close" aria-label="Close customer details">
            <X size={19} />
            <span className="sr-only">Close customer details</span>
          </DrawerClose>
        </DrawerHeader>
        <div className="customer-details-content">
          <div className="customer-profile">
            <span className="customer-avatar" aria-hidden="true">{avatarInitial}</span>
            <strong>{name}</strong>
            <small>{phoneNumber || externalUserId}</small>
          </div>
          <div className="details-block">
            <h3>Conversation</h3>
            <div className="details-row"><span>Channel</span><strong>{channel}</strong></div>
            <div className="details-row"><span>Last active</span><strong>{lastActive}</strong></div>
            <div className="details-row"><span>Reply mode</span><strong>{automationPaused ? "Paused" : replyMode}</strong></div>
          </div>
          <div className="details-note"><ShieldCheck size={15} /> The seller stays in control while automatic replies are paused.</div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
