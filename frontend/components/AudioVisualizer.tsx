'use client';

import React, { useRef, useEffect, useState } from 'react';

interface AudioVisualizerProps {
  isListening?: boolean;
  isSpeaking?: boolean;
}

export function AudioVisualizer({ isListening = false, isSpeaking = false }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationIdRef = useRef<number | null>(null);

  const [bars, setBars] = useState<number[]>(Array(64).fill(0));

  useEffect(() => {
    if (!isListening) {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      return;
    }
  }, [isListening]);

  // Determine color based on mode
  const barColor = isSpeaking ? 'rgb(74, 255, 158)' : 'rgb(74, 158, 255)';
  const glowColor = isSpeaking
    ? 'radial-gradient(ellipse at 50% 100%, rgba(74, 255, 158, 0.3), transparent)'
    : 'radial-gradient(ellipse at 50% 100%, rgba(74, 158, 255, 0.3), transparent)';

  if (!isListening) {
    return null;
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black via-black/60 to-transparent">
      <div
        className="absolute bottom-0 left-0 right-0 h-20 flex items-end justify-center gap-1 px-4 py-6"
        style={{ backgroundImage: glowColor }}
      >
        {bars.map((bar, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-all duration-75"
            style={{
              height: `${Math.max(2, bar * 100)}%`,
              backgroundColor: barColor,
              boxShadow: `0 0 ${Math.max(4, bar * 20)}px ${barColor}`,
            }}
            role="presentation"
            aria-hidden="true"
          />
        ))}
      </div>

    </div>
  );
}
