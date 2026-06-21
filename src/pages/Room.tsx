import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom'
import VideoGrid from '../components/VideoGrid'
import Sidebar from '../components/Sidebar'
import Banner from '../components/Banner'
import { generateClientId, isValidRoomId } from '../lib/roomId'
import { loadPrefs, isValidNickname } from '../lib/storage'
import { useStudyLog } from '../hooks/useStudyLog'
import { useSignaling } from '../hooks/useSignaling'
import CameraGate from '../components/CameraGate'
import { useLocalCamera } from '../hooks/useLocalCamera'
import { useWebRTC } from '../hooks/useWebRTC'
import type { ChatMessage, MemberInfo, SignalingMessage, SyncTimerState, TimerCommand } from '../lib/signaling'
import { isMobile, isSecureContext, hasTurnServer } from '../lib/constants'
import { getBrowserSupportMessage } from '../lib/browser'

interface RoomLocationState {
  password?: string
}

function getRoomPassword(roomId: string, locationState: unknown): string {
  const fromState = (locationState as RoomLocationState | null)?.password
  if (fromState) {
    sessionStorage.setItem(`cloudalcove:pw:${roomId}`, fromState)
    return fromState
  }
  return sessionStorage.getItem(`cloudalcove:pw:${roomId}`) ?? ''
}

export default function Room() {
  const { roomId: rawRoomId } = useParams<{ roomId: string }>()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { recordFocus } = useStudyLog()

  const roomId = rawRoomId?.toUpperCase() ?? ''
  const isHost = searchParams.get('host') === '1'
  const roomPassword = useMemo(
    () => getRoomPassword(roomId, location.state),
    [roomId, location.state],
  )
  const prefs = loadPrefs()
  const nickname = prefs.nickname || ''
  const clientId = useMemo(() => generateClientId(), [])
  const nicknameValid = isValidNickname(nickname)
  const roomValid = isValidRoomId(roomId)

  const [modal, setModal] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [hostId, setHostId] = useState<string | null>(null)
  const [memberCount, setMemberCount] = useState(1)
  const [hasPassword, setHasPassword] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [timerState, setTimerState] = useState<SyncTimerState | null>(null)

  const webrtcRef = useRef<ReturnType<typeof useWebRTC> | null>(null)
  const leaveRef = useRef<() => void>(() => {})
  const localStreamRef = useRef<MediaStream | null>(null)
  const membersRef = useRef<MemberInfo[]>([])

  const camera = useLocalCamera()
  localStreamRef.current = camera.localStream

  useEffect(() => {
    if (!nicknameValid) navigate('/')
  }, [nicknameValid, navigate])

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3000)
  }, [])

  const handleSignalingMessage = useCallback(
    (msg: SignalingMessage) => {
      const webrtc = webrtcRef.current
      if (!webrtc) return

      const syncIfReady = () => {
        if (localStreamRef.current) {
          webrtc.syncMembers(membersRef.current)
        }
      }

      switch (msg.type) {
        case 'joined':
          setHostId(msg.hostId)
          setMemberCount(msg.members.length)
          setHasPassword(msg.hasPassword)
          setChatMessages(msg.chatHistory)
          setTimerState(msg.timer)
          membersRef.current = msg.members
          syncIfReady()
          break
        case 'member-joined':
          setHostId(msg.hostId)
          setMemberCount(msg.members.length)
          membersRef.current = msg.members
          syncIfReady()
          break
        case 'member-left':
          setHostId(msg.hostId)
          setMemberCount(msg.members.length)
          membersRef.current = msg.members
          webrtc.destroyPeer(msg.clientId)
          syncIfReady()
          break
        case 'host-changed':
          setHostId(msg.hostId)
          if (msg.hostId === clientId) {
            showToast('당신이 새 방장이 되었습니다.')
          } else {
            showToast('방장이 변경되었습니다.')
          }
          break
        case 'signal':
          webrtc.handleSignal(msg.from, msg.data)
          break
        case 'chat':
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === msg.message.id)) return prev
            return [...prev, msg.message]
          })
          break
        case 'timer-sync':
          setTimerState(msg.timer)
          break
        case 'room-closed':
          setModal('방이 종료되었습니다.')
          setTimeout(() => navigate('/'), 2000)
          break
        case 'error':
          setModal(msg.message)
          if (
            msg.code === 'ROOM_FULL' ||
            msg.code === 'ROOM_NOT_FOUND' ||
            msg.code === 'WRONG_PASSWORD'
          ) {
            setTimeout(() => navigate('/'), 2500)
          }
          break
      }
    },
    [navigate, clientId, showToast],
  )

  const { sendSignal, sendChat, sendTimerCommand, leave } = useSignaling({
    roomId,
    clientId,
    nickname,
    isHost,
    password: roomPassword,
    enabled: nicknameValid && roomValid,
    onMessage: handleSignalingMessage,
    onConnectionChange: setConnected,
  })

  leaveRef.current = leave

  const webrtc = useWebRTC({
    clientId,
    localStream: camera.localStream,
    sendSignal,
  })

  webrtcRef.current = webrtc

  // 카메라 준비 후 대기 중이던 멤버와 연결
  useEffect(() => {
    if (!camera.cameraReady || !camera.localStream) return
    webrtcRef.current?.syncMembers(membersRef.current)
  }, [camera.cameraReady, camera.localStream])

  const handleLeave = useCallback(() => {
    webrtc.cleanup()
    leave()
    sessionStorage.removeItem(`cloudalcove:pw:${roomId}`)
    navigate('/')
  }, [webrtc, leave, navigate, roomId])

  const handleTimerCommand = useCallback(
    (cmd: TimerCommand) => {
      sendTimerCommand(cmd.action)
    },
    [sendTimerCommand],
  )

  useEffect(() => {
    const onBeforeUnload = () => {
      webrtcRef.current?.cleanup()
      leaveRef.current()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const browserWarning = getBrowserSupportMessage()
  const isRoomHost = hostId === clientId

  if (!nicknameValid) return null

  if (!roomValid) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950">
        <p className="text-slate-400">잘못된 Room ID입니다.</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500"
        >
          대시보드로
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {!camera.cameraReady && (
        <CameraGate
          error={camera.cameraError}
          requesting={camera.cameraRequesting}
          onStart={() => void camera.startCamera()}
        />
      )}

      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3 lg:px-6">
        <div>
          <h1 className="text-lg font-semibold text-white">CloudAlcove</h1>
          <p className="text-xs text-slate-500">
            Room <span className="font-mono text-emerald-400">{roomId}</span>
            {hasPassword && ' · 🔒'}
            {' · '}
            {memberCount}/4명
            {isRoomHost && ' · 방장'}
            {!connected && ' · 연결 중...'}
          </p>
        </div>
      </header>

      {browserWarning && <Banner message={browserWarning} />}

      {!isSecureContext() && (
        <Banner message="보안 연결(HTTPS)이 필요합니다. 카메라를 사용하려면 HTTPS로 접속하세요." />
      )}

      {!hasTurnServer() && import.meta.env.PROD && (
        <Banner
          message="TURN 서버 미설정 — 일부 네트워크에서 영상 연결이 실패할 수 있습니다."
          variant="info"
        />
      )}

      {isMobile() && (
        <Banner
          message="모바일에서는 화면 공유가 제한되며, 4인 연결 시 성능이 저하될 수 있습니다."
          variant="info"
        />
      )}

      <main className="mx-auto flex max-w-6xl flex-col gap-6 p-4 lg:flex-row lg:p-6">
        <div className="flex-1">
          <VideoGrid
            localNickname={nickname}
            localStream={camera.localStream}
            remotePeers={webrtc.remotePeers}
            isScreenSharing={webrtc.isScreenSharing}
            onRetryPeer={webrtc.retryPeer}
          />
        </div>

        <Sidebar
          roomId={roomId}
          hasPassword={hasPassword}
          cameraEnabled={webrtc.cameraEnabled}
          micEnabled={webrtc.micEnabled}
          isScreenSharing={webrtc.isScreenSharing}
          isHost={isRoomHost}
          chatMessages={chatMessages}
          timerState={timerState}
          onToggleCamera={webrtc.toggleCamera}
          onToggleMic={webrtc.toggleMic}
          onToggleScreenShare={webrtc.toggleScreenShare}
          onLeave={handleLeave}
          onFocusComplete={recordFocus}
          onSendChat={sendChat}
          onTimerCommand={handleTimerCommand}
        />
      </main>

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-200 shadow-lg lg:bottom-6">
          {toast}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-w-sm rounded-2xl bg-slate-900 p-6 text-center ring-1 ring-slate-700">
            <p className="text-slate-200">{modal}</p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500"
            >
              대시보드로
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
