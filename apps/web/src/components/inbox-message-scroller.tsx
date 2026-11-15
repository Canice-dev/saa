"use client";

import { ArrowDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type InboxMessageScrollerProps = {
  children: ReactNode;
  messageCount: number;
};

const BOTTOM_THRESHOLD_PX = 48;

export function InboxMessageScroller({ children, messageCount }: InboxMessageScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const didInitialScrollRef = useRef(false);
  const [showLatestButton, setShowLatestButton] = useState(false);

  const updateScrollPosition = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    const isAtBottom = distanceFromBottom <= BOTTOM_THRESHOLD_PX;
    isAtBottomRef.current = isAtBottom;
    setShowLatestButton(!isAtBottom);
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    if (!didInitialScrollRef.current) {
      element.scrollTop = element.scrollHeight;
      didInitialScrollRef.current = true;
      isAtBottomRef.current = true;
      return;
    }

    if (isAtBottomRef.current) {
      element.scrollTop = element.scrollHeight;
      setShowLatestButton(false);
    }
  }, [messageCount]);

  const moveToLatest = () => {
    const element = scrollRef.current;
    if (!element) return;
    isAtBottomRef.current = true;
    setShowLatestButton(false);
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  };

  return (
    <div className="thread-message-area">
      <div
        className="thread-messages"
        ref={scrollRef}
        onScroll={updateScrollPosition}
        aria-label="Messages in this conversation"
      >
        {children}
      </div>
      {showLatestButton && (
        <button
          className="thread-scroll-latest"
          type="button"
          onClick={moveToLatest}
          aria-label="Scroll to recent messages"
          title="Scroll to recent messages"
        >
          <ArrowDown size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
