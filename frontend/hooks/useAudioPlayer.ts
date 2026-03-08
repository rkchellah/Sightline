'use client'
import { useRef, useCallback, useState } from 'react'

export function useAudioPlayer() {
  const ctxRef = useRef<AudioContext | null>(null)
  const queue = useRef<AudioBuffer[]>([])
  const playing = useRef(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const isSpeakingRef = useRef(false) // ✅ always has live value — no stale closure

  const getCtx = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext({ sampleRate: 24000 })
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
    return ctxRef.current
  }, [])

  const playNext = useCallback(() => {
    if (queue.current.length === 0) {
      playing.current = false
      // ✅ 400ms cooldown — lets room echo die before mic reopens
      // Without this, Gemini hears itself and treats it as user input → causes delay
      setTimeout(() => {
        isSpeakingRef.current = false
        setIsSpeaking(false)
      }, 400)
      return
    }
    playing.current = true
    isSpeakingRef.current = true // ✅ mic mutes
    setIsSpeaking(true)
    const ctx = getCtx()
    const buf = queue.current.shift()!
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.onended = playNext
    src.start(0)
  }, [getCtx])

  const playAudio = useCallback(async (base64: string) => {
    try {
      const ctx = getCtx()
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const pcm16 = new Int16Array(bytes.buffer)
      const float32 = new Float32Array(pcm16.length)
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768.0
      const buf = ctx.createBuffer(1, float32.length, 24000)
      buf.copyToChannel(float32, 0)
      queue.current.push(buf)
      if (!playing.current) playNext()
    } catch (e) {
      console.error('Audio playback error:', e)
    }
  }, [getCtx, playNext])

  return { playAudio, isSpeaking, isSpeakingRef }
}