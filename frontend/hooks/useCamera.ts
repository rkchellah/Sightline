'use client'
import { useRef, useState, useEffect, useCallback } from 'react'

export function useCamera(onAudioChunk?: (base64: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null!)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')

  useEffect(() => {
    if (!isActive || !streamRef.current) return
    const video = videoRef.current
    if (!video) return
    video.srcObject = streamRef.current
    video.muted = true
    video.play().catch(() => { })
  }, [isActive])

  const startAudioCapture = useCallback((stream: MediaStream) => {
    if (!onAudioChunk) return
    try {
      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0)
        const pcm16 = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]))
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
        }
        const bytes = new Uint8Array(pcm16.buffer)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        onAudioChunk(btoa(binary))
      }
      source.connect(processor)
      processor.connect(audioContext.destination)
    } catch (err) {
      console.error('Audio capture error:', err)
    }
  }, [onAudioChunk])

  const startCamera = useCallback(async (mode?: 'user' | 'environment') => {
    const selectedMode = mode || facingMode
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: selectedMode },
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 }
      })
      streamRef.current = stream
      setIsActive(true)
      setIsListening(true)
      startAudioCapture(stream)
    } catch (err) {
      console.error('Camera error:', err)
      throw err
    }
  }, [facingMode, startAudioCapture])

  const stopCamera = useCallback(() => {
    processorRef.current?.disconnect()
    processorRef.current = null
    audioContextRef.current?.close()
    audioContextRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setIsActive(false)
    setIsListening(false)
  }, [])

  const toggleCamera = useCallback(async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(newMode)
    if (isActive) {
      stopCamera()
      setTimeout(() => startCamera(newMode), 300)
    }
  }, [facingMode, isActive, stopCamera, startCamera])

  // maxWidth: 640 is enough for camera scenes; screen shares pass 1280
  // so on-screen text stays legible for Gemini.
  const captureFrame = useCallback((maxWidth: number = 640): string | null => {
    const video = videoRef.current
    if (!video || !isActive || video.readyState < 2) return null
    const vw = video.videoWidth || 640
    const vh = video.videoHeight || 480
    const scale = Math.min(1, maxWidth / vw)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(vw * scale)
    canvas.height = Math.round(vh * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.6).split(',')[1]
  }, [isActive])

  const getAudioStream = useCallback(() => streamRef.current, [])

  return { videoRef, isActive, isListening, facingMode, startCamera, stopCamera, toggleCamera, captureFrame, getAudioStream }
}
