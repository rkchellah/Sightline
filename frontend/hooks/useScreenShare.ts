'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Screen capture via getDisplayMedia. Consent is browser-enforced:
 * sharing can only start from a user gesture, and the browser shows
 * its own "stop sharing" bar which we listen to via the track's
 * `ended` event.
 */
export function useScreenShare() {
  const [isSharing, setIsSharing] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    setIsSupported(
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getDisplayMedia === 'function'
    )
  }, [])

  const startScreenShare = useCallback(
    async (onEnded?: () => void): Promise<MediaStream | null> => {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 5 } },
          audio: false, // mic keeps coming from the camera stream
        })
        streamRef.current = stream
        setIsSharing(true)

        // User clicked the browser's native "Stop sharing" bar
        stream.getVideoTracks()[0]?.addEventListener('ended', () => {
          streamRef.current = null
          setIsSharing(false)
          onEnded?.()
        })
        return stream
      } catch {
        // User dismissed the picker — not an error
        return null
      }
    },
    []
  )

  const stopScreenShare = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setIsSharing(false)
  }, [])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  return { isSharing, isSupported, startScreenShare, stopScreenShare }
}
