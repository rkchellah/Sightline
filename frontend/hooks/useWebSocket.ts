'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export type WSMessage = {
  type: string
  data: string
}

const WS_URL = 'wss://sightline-backend-59597652459.us-east4.run.app/ws'

export function useWebSocket() {
  const [status, setStatus] = useState<WSStatus>('connecting')
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState<WSMessage[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<NodeJS.Timeout | null>(null)
  const attemptsRef = useRef(0)
  const unmountedRef = useRef(false)

  const connect = useCallback(() => {
    if (unmountedRef.current) return
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) return

    setStatus('connecting')
    setIsConnected(false)

    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        if (unmountedRef.current) return
        console.log('✅ WebSocket connected')
        setMessages([])  // clear stale messages from previous session
        setStatus('connected')
        setIsConnected(true)
        attemptsRef.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WSMessage
          setMessages(prev => [...prev.slice(-30), msg])
        } catch (e) {
          console.error('Failed to parse message:', e)
        }
      }

      ws.onclose = (event) => {
        if (unmountedRef.current) return
        console.log(`WebSocket closed: ${event.code}`)
        setStatus('disconnected')
        setIsConnected(false)
        wsRef.current = null

        // Reconnect with backoff (max 5 attempts)
        if (attemptsRef.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, attemptsRef.current), 10000)
          attemptsRef.current++
          console.log(`Reconnecting in ${delay}ms (attempt ${attemptsRef.current})`)
          clearTimeout(reconnectRef.current ?? undefined)
          reconnectRef.current = setTimeout(connect, delay)
        }
      }

      ws.onerror = (event) => {
        console.error('WebSocket error:', event)
        if (!unmountedRef.current) setStatus('error')
      }

    } catch (err) {
      console.error('Failed to create WebSocket:', err)
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    unmountedRef.current = false
    connect()
    return () => {
      unmountedRef.current = true
      clearTimeout(reconnectRef.current ?? undefined)
      wsRef.current?.close()
    }
  }, [connect])

  const sendMessage = useCallback((msg: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    } else {
      console.warn('WebSocket not connected, cannot send:', msg.type)
    }
  }, [])

  const sendAudio = useCallback((base64: string) => {
    sendMessage({ type: 'audio', data: base64 })
  }, [sendMessage])

  const sendFrame = useCallback((base64: string) => {
    sendMessage({ type: 'video_frame', data: base64 })
  }, [sendMessage])

  const sendText = useCallback((text: string) => {
    sendMessage({ type: 'text', data: text })
  }, [sendMessage])

  return { status, isConnected, messages, sendAudio, sendFrame, sendText }
}
