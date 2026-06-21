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

export interface TimerState {
  phase: TimerPhase
  running: boolean
  secondsLeft: number
  endsAt: number | null
}

export interface Env {
  ROOM: DurableObjectNamespace
}

interface ClientSocket {
  clientId: string
  nickname: string
  joinedAt: number
  socket: WebSocket
}

const MAX_MEMBERS = 4
const MAX_CHAT = 50
const FOCUS_SECONDS = 25 * 60
const BREAK_SECONDS = 5 * 60

function defaultTimerState(): TimerState {
  return { phase: 'focus', running: false, secondsLeft: FOCUS_SECONDS, endsAt: null }
}

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function resolveTimerState(state: TimerState): TimerState {
  if (!state.running || !state.endsAt) return state
  const secondsLeft = Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000))
  return { ...state, secondsLeft }
}

export class RoomDO {
  private clients = new Map<string, ClientSocket>()
  private hostId: string | null = null
  private roomCreated = false
  private passwordHash: string | null = null
  private chatHistory: ChatMessage[] = []
  private timerState: TimerState = defaultTimerState()

  constructor(_state: DurableObjectState, _env: Env) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    const clientId = url.searchParams.get('clientId')
    const nickname = url.searchParams.get('nickname') ?? '익명'
    const create = url.searchParams.get('create') === '1'
    const password = url.searchParams.get('password') ?? ''

    if (!clientId) {
      return new Response('Missing clientId', { status: 400 })
    }

    if (!create && !this.roomCreated) {
      return this.rejectWs('ROOM_NOT_FOUND', '존재하지 않는 방입니다.')
    }

    const existing = this.clients.get(clientId)
    const isReconnect = Boolean(existing)

    if (!isReconnect && this.clients.size >= MAX_MEMBERS) {
      return this.rejectWs('ROOM_FULL', '방이 가득 찼습니다 (최대 4명)')
    }

    if (!isReconnect && this.passwordHash) {
      const hash = await hashPassword(password)
      if (hash !== this.passwordHash) {
        return this.rejectWs('WRONG_PASSWORD', '비밀번호가 올바르지 않습니다.')
      }
    }

    if (isReconnect) {
      try {
        existing!.socket.close(1000, 'reconnect')
      } catch {
        // already closed
      }
    }

    const pair = new WebSocketPair()
    const [client, server] = [pair[0], pair[1]]
    server.accept()

    if (create && !this.roomCreated) {
      this.roomCreated = true
      this.hostId = clientId
      if (password.trim()) {
        this.passwordHash = await hashPassword(password.trim())
      }
    }

    const joinedAt = isReconnect ? existing!.joinedAt : Date.now()
    const member: ClientSocket = {
      clientId,
      nickname,
      joinedAt,
      socket: server,
    }

    this.clients.set(clientId, member)

    if (!this.hostId) {
      this.hostId = clientId
    }

    server.addEventListener('message', (event) => {
      void this.handleMessage(clientId, event.data as string)
    })

    server.addEventListener('close', () => {
      if (this.clients.get(clientId)?.socket === server) {
        this.removeClient(clientId)
      }
    })

    server.addEventListener('error', () => {
      if (this.clients.get(clientId)?.socket === server) {
        this.removeClient(clientId)
      }
    })

    const members = this.getMemberList()
    this.send(server, {
      type: 'joined',
      clientId,
      members,
      hostId: this.hostId!,
      hasPassword: Boolean(this.passwordHash),
      chatHistory: this.chatHistory,
      timer: resolveTimerState(this.timerState),
    })

    if (!isReconnect) {
      this.broadcast(
        {
          type: 'member-joined',
          member: { clientId, nickname, joinedAt: member.joinedAt },
          members: this.getMemberList(),
          hostId: this.hostId!,
        },
        clientId,
      )
    }

    return new Response(null, { status: 101, webSocket: client })
  }

  private async handleMessage(fromId: string, raw: string) {
    let msg: {
      type: string
      to?: string
      data?: unknown
      text?: string
      action?: string
      phase?: TimerPhase
      secondsLeft?: number
    }
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }

    if (msg.type === 'leave') {
      this.removeClient(fromId)
      return
    }

    if (msg.type === 'signal' && msg.to) {
      const target = this.clients.get(msg.to)
      if (target) {
        this.send(target.socket, { type: 'signal', from: fromId, data: msg.data })
      }
      return
    }

    if (msg.type === 'chat') {
      const client = this.clients.get(fromId)
      if (!client) return
      const text = String(msg.text ?? '')
        .trim()
        .slice(0, 500)
      if (!text) return

      const chatMsg: ChatMessage = {
        id: crypto.randomUUID(),
        clientId: fromId,
        nickname: client.nickname,
        text,
        sentAt: Date.now(),
      }
      this.chatHistory.push(chatMsg)
      if (this.chatHistory.length > MAX_CHAT) {
        this.chatHistory = this.chatHistory.slice(-MAX_CHAT)
      }
      this.broadcast({ type: 'chat', message: chatMsg })
      return
    }

    if (msg.type === 'timer') {
      if (fromId !== this.hostId) return
      this.applyTimerAction(msg.action ?? '', msg.phase, msg.secondsLeft)
      this.broadcast({ type: 'timer-sync', timer: resolveTimerState(this.timerState) })
    }
  }

  private applyTimerAction(action: string, phase?: TimerPhase, secondsLeft?: number) {
    const current = resolveTimerState(this.timerState)

    switch (action) {
      case 'start':
        this.timerState = {
          ...current,
          running: true,
          endsAt: Date.now() + current.secondsLeft * 1000,
        }
        break
      case 'pause':
        this.timerState = {
          ...current,
          running: false,
          endsAt: null,
          secondsLeft: current.secondsLeft,
        }
        break
      case 'reset':
        this.timerState = defaultTimerState()
        break
      case 'phase-complete': {
        const nextPhase: TimerPhase = current.phase === 'focus' ? 'break' : 'focus'
        const nextSeconds = nextPhase === 'focus' ? FOCUS_SECONDS : BREAK_SECONDS
        this.timerState = {
          phase: nextPhase,
          running: false,
          secondsLeft: nextSeconds,
          endsAt: null,
        }
        break
      }
      case 'sync-mode':
        if (typeof secondsLeft === 'number' && phase) {
          this.timerState = {
            phase,
            running: false,
            secondsLeft,
            endsAt: null,
          }
        }
        break
    }
  }

  private removeClient(clientId: string) {
    if (!this.clients.has(clientId)) return
    this.clients.delete(clientId)

    if (this.clients.size === 0) {
      this.roomCreated = false
      this.hostId = null
      this.passwordHash = null
      this.chatHistory = []
      this.timerState = defaultTimerState()
      return
    }

    if (this.hostId === clientId) {
      const nextHost = [...this.clients.values()].sort((a, b) => a.joinedAt - b.joinedAt)[0]
      this.hostId = nextHost.clientId
      this.broadcast({ type: 'host-changed', hostId: this.hostId })
    }

    const members = this.getMemberList()
    this.broadcast({
      type: 'member-left',
      clientId,
      hostId: this.hostId!,
      members,
    })
  }

  private getMemberList(): MemberInfo[] {
    return [...this.clients.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map(({ clientId, nickname, joinedAt }) => ({ clientId, nickname, joinedAt }))
  }

  private broadcast(payload: Record<string, unknown>, except?: string) {
    for (const [id, client] of this.clients) {
      if (id !== except) {
        this.send(client.socket, payload)
      }
    }
  }

  private send(socket: WebSocket, payload: Record<string, unknown>) {
    try {
      socket.send(JSON.stringify(payload))
    } catch {
      // closed
    }
  }

  private rejectWs(code: string, message: string): Response {
    const pair = new WebSocketPair()
    const [client, server] = [pair[0], pair[1]]
    server.accept()
    server.addEventListener('open', () => {
      server.send(JSON.stringify({ type: 'error', code, message }))
      server.close(1008, message)
    })
    return new Response(null, { status: 101, webSocket: client })
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/ws') {
      const roomId = url.searchParams.get('roomId')
      if (!roomId) {
        return new Response('Missing roomId', { status: 400 })
      }
      const id = env.ROOM.idFromName(roomId.toUpperCase())
      const stub = env.ROOM.get(id)
      return stub.fetch(request)
    }

    if (url.pathname === '/') {
      return new Response('CloudAlcove Signaling Worker', { status: 200 })
    }

    return new Response('Not Found', { status: 404 })
  },
} satisfies ExportedHandler<Env>
