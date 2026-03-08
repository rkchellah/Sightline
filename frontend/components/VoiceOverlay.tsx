'use client';

import React, { useEffect, useRef } from 'react';

interface VoiceOverlayProps {
  messages: string[];
}

export function VoiceOverlay({ messages }: VoiceOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to latest message
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [messages]);

  // Get the last 3 messages
  const displayMessages = messages.slice(-3);

  if (displayMessages.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute bottom-28 left-1/2 transform -translate-x-1/2 max-w-2xl w-full px-4"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="space-y-2">
        {displayMessages.map((message, i) => (
          <div
            key={i}
            className="animate-fade-in"
            style={{
              animationDelay: `${i * 100}ms`,
            }}
          >
            <div className="px-4 py-3 rounded-2xl bg-black/70 backdrop-blur-md border border-blue-400/20 shadow-lg">
              <p className="text-sm text-white font-light leading-relaxed">{message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
