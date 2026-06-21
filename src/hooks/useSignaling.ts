import { useEffect, useRef, useCallback } from 'react'
import { getSignalingBaseUrl } from '../lib/constants'
import {
  buildSignalingUrl,
  type SignalingMessage,
  type UseSignalingOptions,
} from '../lib/signaling'

const MAX_RECONNECT_ATTEMPTS = 3

export interface UseSignalingOptionsExtended extends UseSignalingOptions {
  enabled?: boolean
}

export function useSignaling({
  roomId,
  clientId,
  nickname,
  isHost,
  password = '',
  onMessage,
  onConnectionChange,
  enabled = true,
}: UseSignalingOptionsExtended) {
  const wsRef = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  const onConnectionChangeRef = useRef(onConnectionChange)
  const intentionalLeaveRef = useRef(false)
  const retryCountRef = useRef(0)
  const reconnectTimerRef = useRef<number | null>(null)

  onMessageRef.current = onMessage
  onConnectionChangeRef.current = onConnectionChange

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

  const send = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload))
    }
  }, [])

  const sendSignal = useCallback(
    (to: string, data: unknown) => {
      send({ type: 'signal', to, data })
    },
    [send],
  )

  const sendChat = useCallback(
    (text: string) => {
      send({ type: 'chat', text })
    },
    [send],
  )

  const sendTimerCommand = useCallback(
    (action: string, extra?: Record<string, unknown>) => {
      send({ type: 'timer', action, ...extra })
    },
    [send],
  )

  const leave = useCallback(() => {
    intentionalLeaveRef.current = true
    clearReconnectTimer()
    send({ type: 'leave' })
    wsRef.current?.close()
    wsRef.current = null
  }, [send, clearReconnectTimer])

  useEffect(() => {
    if (!enabled || !roomId) return

    intentionalLeaveRef.current = false
    retryCountRef.current = 0

    const base = getSignalingBaseUrl()
    const url = buildSignalingUrl(base, roomId, clientId, nickname, isHost, password)

    const connect = () => {
      if (intentionalLeaveRef.current) return

      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        retryCountRef.current = 0
        onConnectionChangeRef.current?.(true)
      }

      ws.onclose = () => {
        onConnectionChangeRef.current?.(false)
        wsRef.current = null

        if (intentionalLeaveRef.current) return
        if (retryCountRef.current >= MAX_RECONNECT_ATTEMPTS) return

        retryCountRef.current += 1
        const delay = 1000 * retryCountRef.current
        reconnectTimerRef.current = window.setTimeout(connect, delay)
      }

      ws.onerror = () => onConnectionChangeRef.current?.(false)

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as SignalingMessage
          onMessageRef.current(msg)
        } catch {
          // ignore malformed
        }
      }
    }

    connect()

    return () => {
      intentionalLeaveRef.current = true
      clearReconnectTimer()
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [roomId, clientId, nickname, isHost, password, enabled, clearReconnectTimer])

  return { send, sendSignal, sendChat, sendTimerCommand, leave }
}
