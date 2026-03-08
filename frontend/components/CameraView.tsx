'use client'
import { RefObject } from 'react'

interface CameraViewProps {
  videoRef: RefObject<HTMLVideoElement>
}

export function CameraView({ videoRef }: CameraViewProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: '#000' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={(e) => {
          const v = e.currentTarget
          if (v.paused) v.play().catch(() => { })
        }}
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', zIndex: 1,
        }}
      />
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2,
        pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.03) 3px, rgba(0,0,0,0.03) 4px)',
      }} />
      <div style={{
        position: 'absolute', top: 16, right: 16, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(0,0,0,0.6)', padding: '4px 12px',
        borderRadius: 999, border: '1px solid rgba(239,68,68,0.4)'
      }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
        <span style={{ color: '#fff', fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.15em' }}>LIVE</span>
      </div>
    </div>
  )
}
