export const FOCUS_SECONDS = 25 * 60
export const BREAK_SECONDS = 5 * 60

export const MAX_ROOM_MEMBERS = 4

function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]

  const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined
  const turnUsername = import.meta.env.VITE_TURN_USERNAME as string | undefined
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined

  if (turnUrl && turnUsername && turnCredential) {
    servers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    })
  }

  const customJson = import.meta.env.VITE_ICE_SERVERS as string | undefined
  if (customJson) {
    try {
      const parsed = JSON.parse(customJson) as RTCIceServer[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    } catch {
      // fall through to default + TURN
    }
  }

  return servers
}

export const ICE_SERVERS: RTCIceServer[] = buildIceServers()

export function hasTurnServer(): boolean {
  return ICE_SERVERS.some((s) => {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls]
    return urls.some((u) => u.startsWith('turn:'))
  })
}

/** Cloudflare Pages 배포 시 시그널링 Worker (env 미설정 폴백) */
const DEFAULT_PRODUCTION_SIGNALING_URL = 'wss://cloudalcove.ip9mong.workers.dev'

export function getSignalingBaseUrl(): string {
  const env = import.meta.env.VITE_SIGNALING_URL as string | undefined
  if (env?.trim()) return env.replace(/\/$/, '')

  // Pages 도메인은 정적 호스팅만 제공 — Worker로 연결
  if (import.meta.env.PROD && window.location.hostname.endsWith('.pages.dev')) {
    return DEFAULT_PRODUCTION_SIGNALING_URL
  }

  const { protocol, host } = window.location
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:'
  return `${wsProtocol}//${host}`
}

export function playNotificationSound(): void {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.value = 0.08
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
    osc.onended = () => void ctx.close()
  } catch {
    // ignore
  }
}

export function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export function isSecureContext(): boolean {
  return window.isSecureContext
}

export function resolveSyncedSeconds(timer: {
  running: boolean
  secondsLeft: number
  endsAt: number | null
}): number {
  if (timer.running && timer.endsAt) {
    return Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000))
  }
  return timer.secondsLeft
}
