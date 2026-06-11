"use client";

import { motion } from "framer-motion";

import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "coach";
  children?: React.ReactNode;
  timestamp?: Date;
  /** Renders the three-dot typing indicator instead of content. */
  typing?: boolean;
}

export function ChatMessage({
  role,
  children,
  timestamp,
  typing,
}: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "tween", ease: "easeOut", duration: 0.4 }}
      className={cn(
        "flex flex-col gap-1",
        isUser ? "items-end" : "items-start"
      )}
    >
      <div
        className={cn(
          "max-w-md rounded-xl border px-4 py-3",
          isUser
            ? "bg-accent-dim border-accent-border"
            : "bg-surface border-border"
        )}
      >
        {typing ? <TypingIndicator /> : children}
      </div>
      {timestamp && (
        <span className="px-1 text-xs text-text-tertiary">
          {formatTime(timestamp)}
        </span>
      )}
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="Coach is typing">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1 rounded-full bg-text-secondary"
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}
