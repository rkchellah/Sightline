'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCamera } from '@/hooks/useCamera';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { CameraView } from '@/components/CameraView';
import { AudioVisualizer } from '@/components/AudioVisualizer';
import { VoiceOverlay } from '@/components/VoiceOverlay';

export default function Home() {
  const { videoRef, isListening, facingMode, startCamera, stopCamera, toggleCamera, captureFrame, getAudioStream } = useCamera();
  const { isConnected, sendAudio, sendFrame, messages } = useWebSocket();
  const { playAudio, isSpeaking, isSpeakingRef } = useAudioPlayer();

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayMessages, setDisplayMessages] = useState<string[]>([]);
  const [sessionMode, setSessionMode] = useState('READY');

  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.type === 'audio') {
      setIsProcessing(false);
      playAudio(last.data);
    }
    if (last.type === 'text') setDisplayMessages(prev => [...prev, last.data]);
    if (last.type === 'turn_complete') {
      setIsProcessing(false);
      console.log('🎤 Gemini done — mic reopened');
    }
  }, [messages, playAudio]);

  useEffect(() => {
    if (!isSessionActive) return;
    if (isSpeaking) {
      setSessionMode('SPEAKING');
      setIsProcessing(false);
    } else {
      setSessionMode(isProcessing ? 'PROCESSING' : 'LISTENING');
    }
  }, [isSpeaking, isProcessing, isSessionActive]);

  useEffect(() => {
    if (!isSessionActive) return;
    frameIntervalRef.current = setInterval(() => {
      const frame = captureFrame();
      if (frame) sendFrame(frame);
    }, 1500);
    return () => { if (frameIntervalRef.current) clearInterval(frameIntervalRef.current); };
  }, [isSessionActive, captureFrame, sendFrame]);

  useEffect(() => {
    if (!isSessionActive) return;
    let isClosed = false;
    const audioStream = getAudioStream();
    if (!audioStream) return;
    const ctx = new AudioContext({ sampleRate: 16000 });
    audioContextRef.current = ctx;
    const source = ctx.createMediaStreamSource(audioStream);
    const processor = ctx.createScriptProcessor(2048, 1, 1);
    processorRef.current = processor;
    processor.onaudioprocess = (e) => {
      if (isClosed) return;
      if (isSpeakingRef.current) return;
      const input = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        pcm16[i] = Math.max(-32768, Math.min(32767, input[i] * 32768));
      }
      const base64 = btoa(String.fromCharCode(...Array.from(new Uint8Array(pcm16.buffer))));
      sendAudio(base64);

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        if (!isSpeakingRef.current) setIsProcessing(true);
      }, 1200);
    };
    source.connect(processor);
    processor.connect(ctx.destination);
    return () => {
      isClosed = true;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      try { processor.disconnect(); source.disconnect(); if (ctx.state !== 'closed') ctx.close(); } catch { }
    };
  }, [isSessionActive, getAudioStream, sendAudio, isSpeakingRef]);

  const handleStart = async () => {
    await startCamera();
    setIsSessionActive(true);
    setIsProcessing(false);
    setSessionMode('LISTENING');
    setDisplayMessages([]);
  };

  const handleStop = () => {
    setIsSessionActive(false);
    setIsProcessing(false);
    setSessionMode('READY');
    setDisplayMessages([]);
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (processorRef.current) processorRef.current.disconnect();
    if (audioContextRef.current?.state !== 'closed') audioContextRef.current?.close();
    stopCamera();
  };

  useEffect(() => {
    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (processorRef.current) processorRef.current.disconnect();
      if (audioContextRef.current?.state !== 'closed') audioContextRef.current?.close();
    };
  }, []);

  // 🟢 green = listening | 🟡 yellow = processing | 🔵 blue = speaking
  const statusColor = isSpeaking
    ? '#38bdf8'
    : isProcessing
      ? '#facc15'
      : isConnected
        ? '#4aff9e'
        : '#facc15';

  const statusLabel = isSessionActive
    ? sessionMode
    : isConnected ? 'READY' : 'CONNECTING...';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300;1,400&family=DM+Mono:wght@300;400&family=Bebas+Neue&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0c; overflow: hidden; }

        @keyframes fadeIn { from{opacity:0}to{opacity:1} }
        @keyframes slideUp {
          from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}
        }
        @keyframes ripple {
          0%{transform:translate(-50%,-50%) scale(1);opacity:0.5}
          100%{transform:translate(-50%,-50%) scale(3.5);opacity:0}
        }
        @keyframes iris-breathe {
          0%,100%{transform:translate(-50%,-50%) scale(1);opacity:0.6}
          50%{transform:translate(-50%,-50%) scale(1.06);opacity:0.9}
        }
        @keyframes iris-breathe-2 {
          0%,100%{transform:translate(-50%,-50%) scale(1);opacity:0.35}
          50%{transform:translate(-50%,-50%) scale(1.1);opacity:0.55}
        }
        @keyframes iris-breathe-3 {
          0%,100%{transform:translate(-50%,-50%) scale(1);opacity:0.15}
          50%{transform:translate(-50%,-50%) scale(1.14);opacity:0.28}
        }
        @keyframes iris-rotate {
          from{transform:translate(-50%,-50%) rotate(0deg)}
          to{transform:translate(-50%,-50%) rotate(360deg)}
        }
        @keyframes iris-rotate-rev {
          from{transform:translate(-50%,-50%) rotate(0deg)}
          to{transform:translate(-50%,-50%) rotate(-360deg)}
        }
        @keyframes pupil-pulse {
          0%,100%{transform:translate(-50%,-50%) scale(1);opacity:0.9}
          50%{transform:translate(-50%,-50%) scale(1.2);opacity:1}
        }
        @keyframes scanline { 0%{top:-2px}100%{top:100vh} }
        @keyframes glow-pulse { 0%,100%{opacity:0.12}50%{opacity:0.22} }

        /* ✅ Blue speak border animation */
        @keyframes speakBorder {
          0%,100%{box-shadow:inset 0 0 0 0 rgba(56,189,248,0)}
          50%{box-shadow:inset 0 0 40px rgba(56,189,248,0.1)}
        }

        @keyframes barDance { 0%,100%{height:4px}50%{height:20px} }
        @keyframes livePulse { 0%,100%{opacity:1}50%{opacity:0.35} }
        @keyframes processingPulse { 0%,100%{opacity:1}50%{opacity:0.3} }

        .sl-page {
          position:relative; width:100vw; height:100vh;
          background:radial-gradient(ellipse 120% 80% at 50% 60%,#0f0f14 0%,#07070a 100%);
          overflow:hidden; display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          animation:fadeIn 1.2s ease forwards;
        }
        .sl-scanline {
          position:fixed; left:0; right:0; height:1px;
          background:linear-gradient(to right,transparent,rgba(74,255,158,0.04),transparent);
          animation:scanline 10s linear infinite; pointer-events:none; z-index:50;
        }
        .sl-noise {
          position:fixed; inset:0; opacity:0.035;
          background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size:180px; pointer-events:none; z-index:200;
        }
        .sl-vignette {
          position:fixed; inset:0;
          background:radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,0.75) 100%);
          pointer-events:none; z-index:10;
        }
        .sl-eye-bg { position:absolute; top:95%; left:80%; pointer-events:none; z-index:1; }
        @media(max-width:600px){ .sl-eye-bg { display:none; } }
        .sl-iris-glow {
          position:absolute; top:50%; left:50%; width:500px; height:500px; border-radius:50%;
          background:radial-gradient(circle,rgba(74,255,158,0.06) 0%,transparent 65%);
          transform:translate(-50%,-50%); animation:glow-pulse 4s ease-in-out infinite;
        }
        .sl-iris-1 {
          position:absolute; top:50%; left:50%; width:700px; height:700px; border-radius:50%;
          border:1px solid rgba(74,255,158,0.08); animation:iris-breathe 5s ease-in-out infinite;
        }
        .sl-iris-2 {
          position:absolute; top:50%; left:50%; width:520px; height:520px; border-radius:50%;
          border:1px solid rgba(74,255,158,0.12); animation:iris-breathe-2 5s ease-in-out infinite 0.4s;
        }
        .sl-iris-3 {
          position:absolute; top:50%; left:50%; width:360px; height:360px; border-radius:50%;
          border:1px solid rgba(74,255,158,0.18); animation:iris-breathe-3 5s ease-in-out infinite 0.8s;
        }
        .sl-iris-dash-1 {
          position:absolute; top:50%; left:50%; width:620px; height:620px; border-radius:50%;
          border:1px dashed rgba(255,255,255,0.04); animation:iris-rotate 40s linear infinite;
        }
        .sl-iris-dash-2 {
          position:absolute; top:50%; left:50%; width:440px; height:440px; border-radius:50%;
          border:1px dashed rgba(74,255,158,0.06); animation:iris-rotate-rev 28s linear infinite;
        }
        .sl-pupil {
          position:absolute; top:50%; left:50%; width:80px; height:80px; border-radius:50%;
          background:radial-gradient(circle,rgba(74,255,158,0.25) 0%,rgba(74,255,158,0.05) 60%,transparent 100%);
          animation:pupil-pulse 3s ease-in-out infinite;
        }
        .sl-nav {
          position:fixed; top:0; left:0; right:0; padding:26px 36px;
          display:flex; align-items:center; justify-content:space-between;
          flex-wrap:wrap; gap:6px;
          z-index:100; animation:slideUp 1s ease 0.3s both;
        }
        .sl-nav-logo { display:flex; align-items:center; gap:10px; }
        .sl-logo-text {
          font-family:'DM Mono',monospace; font-size:0.6rem; letter-spacing:0.28em;
          color:rgba(255,255,255,0.55); text-transform:uppercase;
        }
        .sl-nav-right {
          font-family:'DM Mono',monospace; font-size:0.55rem; letter-spacing:0.22em;
          color:rgba(255,255,255,0.2); text-transform:uppercase;
          display:none;
        }
        @media(min-width:520px){ .sl-nav-right { display:block; } }
        .sl-session-status {
          position:fixed; top:26px; left:36px;
          display:flex; align-items:center; gap:10px; z-index:100;
        }
        .sl-live-indicator { position:fixed; top:17px; right:17px; display:flex; align-items:center; gap:6px; z-index:100; background:#000 !important; border:1px solid #ff4444; padding:5px 12px; border-radius:999px; transition:opacity 0.4s ease; }
        .sl-live-dot { width:7px; height:7px; border-radius:50%; background:#ff4444; flex-shrink:0; animation:livePulse 1.2s ease-in-out infinite; }
        .sl-live-label { font-family:'DM Mono',monospace; font-size:0.55rem; letter-spacing:0.28em; color:#ff6666; text-transform:uppercase; }
        .sl-content {
          position:relative; z-index:20;
          display:flex; flex-direction:column; align-items:center; text-align:center;
        }
        .sl-title {
          font-family:'Bebas Neue',sans-serif;
          font-size:clamp(5.5rem,14vw,12rem);
          color:#ffffff; line-height:0.85; letter-spacing:0.04em;
          margin-bottom:28px; animation:slideUp 1s ease 0.55s both;
        }
        .sl-tagline {
          font-family:'Cormorant Garamond',serif; font-style:italic; font-weight:300;
          font-size:clamp(1.1rem,2.5vw,1.75rem); color:rgba(255,255,255,0.42);
          letter-spacing:0.03em; line-height:1.5; max-width:520px; margin-bottom:44px;
          animation:slideUp 1s ease 0.7s both;
        }
        .sl-tagline em { font-style:normal; color:rgba(255,255,255,0.82); }
        .sl-status {
          display:flex; align-items:center; justify-content:center;
          gap:10px; margin-bottom:28px; animation:slideUp 1s ease 0.85s both;
        }
        .sl-dot-wrap { position:relative; width:8px; height:8px; flex-shrink:0; }
        .sl-dot { width:8px; height:8px; border-radius:50%; position:relative; z-index:2; }
        .sl-dot-ripple {
          position:absolute; top:50%; left:50%; width:8px; height:8px; border-radius:50%;
          animation:ripple 2.2s ease-out infinite; z-index:1;
        }
        .sl-dot-processing {
          position:absolute; top:50%; left:50%; width:8px; height:8px; border-radius:50%;
          animation:processingPulse 0.7s ease-in-out infinite; z-index:1;
        }
        .sl-status-label {
          font-family:'DM Mono',monospace; font-size:0.6rem; letter-spacing:0.3em; text-transform:uppercase;
        }
        .sl-btn-wrap {
          animation:slideUp 1s ease 1s both;
          display:flex; flex-direction:column; align-items:center; gap:14px;
        }
        .sl-start-btn {
          font-family:'DM Mono',monospace; font-size:0.72rem; letter-spacing:0.38em;
          text-transform:uppercase; background:transparent;
          border:1px solid rgba(255,255,255,0.22); color:#fff;
          padding:16px 60px; border-radius:999px; cursor:pointer;
          transition:all 0.4s ease; position:relative; overflow:hidden;
        }
        .sl-start-btn::before {
          content:''; position:absolute; inset:0; border-radius:999px;
          background:radial-gradient(circle at center,rgba(74,255,158,0.08),transparent 70%);
          opacity:0; transition:opacity 0.4s ease;
        }
        .sl-start-btn:hover:not(:disabled) {
          border-color:rgba(74,255,158,0.5); letter-spacing:0.5em;
          box-shadow:0 0 30px rgba(74,255,158,0.1),0 0 60px rgba(74,255,158,0.05);
        }
        .sl-start-btn:hover:not(:disabled)::before { opacity:1; }
        .sl-start-btn:disabled { opacity:0.3; cursor:not-allowed; }
        .sl-btn-hint {
          font-family:'DM Mono',monospace; font-size:0.52rem; letter-spacing:0.18em;
          color:rgba(255,255,255,0.18); text-transform:uppercase;
        }
        .sl-stop-btn {
          font-family:'DM Mono',monospace; font-size:0.7rem; letter-spacing:0.35em;
          text-transform:uppercase; background:transparent;
          border:1px solid rgba(239,68,68,0.4); color:#f87171;
          padding:13px 44px; border-radius:999px; cursor:pointer; transition:all 0.35s ease;
        }
        .sl-stop-btn:hover { border-color:#ef4444; background:rgba(239,68,68,0.07); }

        .sl-controls { position:fixed; bottom:36px; left:50%; transform:translateX(-50%); display:flex; flex-direction:row; align-items:center; justify-content:center; gap:12px; z-index:100; }
        .sl-flip-btn { font-family:'DM Mono',monospace; font-size:0.65rem; letter-spacing:0.3em; text-transform:uppercase; background:transparent; border:1px solid rgba(255,255,255,0.2); color:rgba(255,255,255,0.7); padding:13px 28px; border-radius:999px; cursor:pointer; transition:all 0.3s ease; white-space:nowrap; }
        .sl-cam-toggle { font-family:'DM Mono',monospace; font-size:0.58rem; letter-spacing:0.22em; text-transform:uppercase; background:transparent; border:1px solid rgba(255,255,255,0.15); color:rgba(255,255,255,0.5); padding:9px 22px; border-radius:999px; cursor:pointer; transition:all 0.3s ease; margin-bottom:16px; }

        /* ✅ Blue border when Gemini speaks */
        .sl-speak-border {
          position:fixed; inset:0; pointer-events:none; z-index:15;
          border:2px solid rgba(56,189,248,0.25);
          animation:speakBorder 1.5s ease-in-out infinite;
        }

        .sl-waveform {
          position:fixed; bottom:100px; left:50%; transform:translateX(-50%);
          display:flex; align-items:center; gap:4px; z-index:50;
        }

        /* ✅ Blue bars when Gemini speaks */
        .sl-bar { width:3px; background:#38bdf8; border-radius:2px; min-height:4px; }

        .sl-bottom {
          position:fixed; bottom:28px; left:0; right:0; text-align:center;
          font-family:'Cormorant Garamond',serif; font-style:italic;
          font-size:0.85rem; color:rgba(255,255,255,0.15); letter-spacing:0.08em;
          animation:slideUp 1s ease 1.2s both; white-space:nowrap; z-index:30;
        }
      `}</style>

      <main className="sl-page">
        {!isSessionActive && <div className="sl-scanline" />}
        {!isSessionActive && <div className="sl-noise" />}
        {!isSessionActive && <div className="sl-vignette" />}

        {/* Rings — idle only */}
        {!isSessionActive && (
          <div className="sl-eye-bg">
            <div className="sl-iris-glow" />
            <div className="sl-iris-1" />
            <div className="sl-iris-dash-1" />
            <div className="sl-iris-2" />
            <div className="sl-iris-dash-2" />
            <div className="sl-iris-3" />
            <div className="sl-pupil" />
          </div>
        )}

        {/* Nav — idle only */}
        {!isSessionActive && (
          <nav className="sl-nav">
            <div className="sl-nav-logo">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <polygon points="10,1 20,19 0,19" fill="white" opacity="0.7" />
              </svg>
              <span className="sl-logo-text">SightLine</span>
            </div>
            <span className="sl-nav-right">Gemini Live Agent Challenge 2026</span>
          </nav>
        )}

        {/* Status — top left during session */}
        {isSessionActive && (
          <div className="sl-session-status">
            <div className="sl-dot-wrap">
              <div className="sl-dot" style={{ backgroundColor: statusColor }} />
              {isProcessing
                ? <div className="sl-dot-processing" style={{ backgroundColor: statusColor }} />
                : <div className="sl-dot-ripple" style={{ backgroundColor: statusColor }} />
              }
            </div>
            <span className="sl-status-label" style={{ color: statusColor }}>
              {statusLabel}
            </span>
          </div>
        )}

        {/* LIVE badge — top right, only when Gemini speaks */}
        {isSessionActive && (
          <div className="sl-live-indicator" style={{ opacity: isSpeaking ? 1 : 0.25 }}>
            <div className="sl-live-dot" />
            <span className="sl-live-label">Live</span>
          </div>
        )}

        {/* IDLE */}
        {!isSessionActive && (
          <div className="sl-content">
            <h1 className="sl-title">SightLine</h1>
            <p className="sl-tagline">
              An AI companion that <em>sees your world</em> and describes it — in real time, through your voice.
            </p>
            <div className="sl-status">
              <div className="sl-dot-wrap">
                <div className="sl-dot" style={{ backgroundColor: statusColor }} />
                <div className="sl-dot-ripple" style={{ backgroundColor: statusColor }} />
              </div>
              <span className="sl-status-label" style={{ color: statusColor }}>
                {isConnected ? 'READY' : 'CONNECTING...'}
              </span>
            </div>
            <div className="sl-btn-wrap">
              <button className="sl-start-btn" onClick={handleStart} disabled={!isConnected}>
                START
              </button>
              <span className="sl-btn-hint">Grant camera &amp; microphone access to begin</span>
            </div>
          </div>
        )}

        {/* ACTIVE */}
        {isSessionActive && (
          <>
            <CameraView videoRef={videoRef} />
            <AudioVisualizer isListening={isListening} isSpeaking={isSpeaking} />
            <VoiceOverlay messages={displayMessages} />
            {isSpeaking && (
              <>
                <div className="sl-speak-border" />
                <div className="sl-waveform">
                  {[...Array(7)].map((_, i) => (
                    <div
                      key={i}
                      className="sl-bar"
                      style={{
                        animation: `barDance ${0.4 + i * 0.07}s ease-in-out infinite`,
                        animationDelay: `${i * 0.08}s`,
                      }}
                    />
                  ))}
                </div>
              </>
            )}
            <div className="sl-controls">
              <button className="sl-stop-btn" onClick={handleStop}>STOP</button>
              <button className="sl-flip-btn" onClick={toggleCamera}>
                {facingMode === 'environment' ? 'FRONT CAM' : 'BACK CAM'}
              </button>
            </div>
          </>
        )}

        {!isSessionActive && <div className="sl-bottom">See the world, live.</div>}
      </main>
    </>
  );
}


