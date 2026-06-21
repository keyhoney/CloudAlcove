export interface MemberInfo {
  clientId: string
  nickname: string
  joinedAt: number
}

export interface ChatMessage {
  id: string
  clientId: string
  nickname: string
  text: string
  sentAt: number
}

export type TimerPhase = 'focus' | 'break'

export interface SyncTimerState {
  phase: TimerPhase
  running: boolean
  secondsLeft: number
  endsAt: number | null
}

export type SignalingMessage =
  | {
      type: 'joined'
      clientId: string
      members: MemberInfo[]
      hostId: string
      hasPassword: boolean
      chatHistory: ChatMessage[]
      timer: SyncTimerState
    }
  | { type: 'member-joined'; member: MemberInfo; members: MemberInfo[]; hostId: string }
  | { type: 'member-left'; clientId: string; hostId: string; members: MemberInfo[] }
  | { type: 'host-changed'; hostId: string }
  | { type: 'room-closed' }
  | { type: 'signal'; from: string; data: unknown }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'timer-sync'; timer: SyncTimerState }
  | { type: 'error'; code: string; message: string }

export type TimerCommand =
  | { action: 'start' }
  | { action: 'pause' }
  | { action: 'reset' }
  | { action: 'phase-complete' }

export interface UseSignalingOptions {
  roomId: string
  clientId: string
  nickname: string
  isHost: boolean
  password?: string
  onMessage: (msg: SignalingMessage) => void
  onConnectionChange?: (connected: boolean) => void
}

export function buildSignalingUrl(
  base: string,
  roomId: string,
  clientId: string,
  nickname: string,
  create: boolean,
  password?: string,
): string {
  const url = new URL('/ws', base)
  url.searchParams.set('roomId', roomId)
  url.searchParams.set('clientId', clientId)
  url.searchParams.set('nickname', nickname)
  if (create) url.searchParams.set('create', '1')
  if (password) url.searchParams.set('password', password)
  return url.toString()
}
