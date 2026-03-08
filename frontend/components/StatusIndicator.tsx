'use client';

import React from 'react';

type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
type Mode = 'idle' | 'listening' | 'processing' | 'speaking';

interface StatusIndicatorProps {
  status: WSStatus;
  mode?: Mode;
}

export function StatusIndicator({ status, mode = 'idle' }: StatusIndicatorProps) {
  const statusConfig: Record<
    WSStatus,
    { color: string; label: string; pulse: boolean }
  > = {
    connecting: { color: 'bg-yellow-400', label: 'CONNECTING', pulse: true },
    connected: { color: 'bg-[#4aff9e]', label: 'CONNECTED', pulse: false },
    disconnected: { color: 'bg-red-500', label: 'OFFLINE', pulse: false },
    error: { color: 'bg-red-500', label: 'ERROR', pulse: true },
  };

  const modeConfig: Record<Mode, string> = {
    idle: 'READY',
    listening: 'LISTENING',
    processing: 'PROCESSING',
    speaking: 'SPEAKING',
  };

  const { color, label, pulse } = statusConfig[status];

  return (
    <div
      className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-full border border-white/10"
      role="status"
      aria-live="polite"
      aria-label={`Connection ${status}: ${status === 'connected' ? modeConfig[mode] : label}`}
    >
      <div className={`w-2 h-2 rounded-full ${color} ${pulse ? 'animate-pulse' : ''}`} />
      <span className="text-white text-xs font-mono tracking-widest">
        {status === 'connected' ? modeConfig[mode] : label}
      </span>
    </div>
  );
}
