import { useCallback, useEffect, useRef, useState } from 'react'
import Peer from 'simple-peer'
import { ICE_SERVERS } from '../lib/constants'
import { releaseCameraStream } from '../lib/mediaSession'
import type { MemberInfo } from '../lib/signaling'

export interface RemotePeer {
  clientId: string
  nickname: string
  stream: MediaStream | null
  status: 'connecting' | 'connected' | 'failed'
}

interface UseWebRTCOptions {
  clientId: string
  localStream: MediaStream | null
  sendSignal: (to: string, data: unknown) => void
}

function shouldInitiate(localId: string, remoteId: string): boolean {
  return localId.localeCompare(remoteId) < 0
}

function isOfferSignal(data: Peer.SignalData): boolean {
  return typeof data === 'object' && data !== null && 'type' in data && data.type === 'offer'
}

function remoteStreamFromTrack(track: MediaStreamTrack, stream?: MediaStream): MediaStream {
  if (stream && stream.getVideoTracks().length > 0) return stream
  return new MediaStream([track])
}

export function useWebRTC({ clientId, localStream, sendSignal }: UseWebRTCOptions) {
  const peersRef = useRef<Map<string, Peer.Instance>>(new Map())
  const localStreamRef = useRef(localStream)
  localStreamRef.current = localStream

  const memberNicknamesRef = useRef<Map<string, string>>(new Map())
  const pendingSignalsRef = useRef<Map<string, Peer.SignalData[]>>(new Map())

  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [micEnabled, setMicEnabled] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([])
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (localStream && !isScreenSharing) {
      cameraStreamRef.current = localStream
    }
  }, [localStream, isScreenSharing])

  const updateRemote = useCallback((id: string, patch: Partial<RemotePeer>) => {
    setRemotePeers((prev) => {
      const idx = prev.findIndex((p) => p.clientId === id)
      if (idx < 0) return prev
      const next = [...prev]
      next[idx] = { ...next[idx], ...patch }
      return next
    })
  }, [])

  const removeRemote = useCallback((peerId: string) => {
    setRemotePeers((prev) => prev.filter((p) => p.clientId !== peerId))
  }, [])

  const addRemotePlaceholder = useCallback((member: MemberInfo) => {
    memberNicknamesRef.current.set(member.clientId, member.nickname)
    setRemotePeers((prev) => {
      if (prev.some((p) => p.clientId === member.clientId)) return prev
      return [
        ...prev,
        {
          clientId: member.clientId,
          nickname: member.nickname,
          stream: null,
          status: 'connecting' as const,
        },
      ]
    })
  }, [])

  const destroyPeer = useCallback(
    (peerId: string) => {
      const peer = peersRef.current.get(peerId)
      if (peer) {
        peer.removeAllListeners()
        peer.destroy()
        peersRef.current.delete(peerId)
      }
      pendingSignalsRef.current.delete(peerId)
      removeRemote(peerId)
    },
    [removeRemote],
  )

  const attachRemoteStream = useCallback(
    (remoteId: string, stream: MediaStream) => {
      updateRemote(remoteId, { stream, status: 'connected' })
    },
    [updateRemote],
  )

  const createPeer = useCallback(
    (remoteId: string, initiator: boolean, stream: MediaStream | null) => {
      if (peersRef.current.has(remoteId)) return

      const peer = new Peer({
        initiator,
        trickle: true,
        stream: stream ?? undefined,
        config: { iceServers: ICE_SERVERS },
      })

      peersRef.current.set(remoteId, peer)

      peer.on('signal', (data) => sendSignal(remoteId, data))
      peer.on('stream', (remoteStream) => {
        attachRemoteStream(remoteId, remoteStream)
      })
      peer.on('track', (track, remoteStream) => {
        if (track.kind === 'video') {
          attachRemoteStream(remoteId, remoteStreamFromTrack(track, remoteStream))
        }
      })
      peer.on('error', () => updateRemote(remoteId, { status: 'failed' }))
      peer.on('close', () => {
        peersRef.current.delete(remoteId)
        pendingSignalsRef.current.delete(remoteId)
      })

      window.setTimeout(() => {
        setRemotePeers((prev) => {
          const p = prev.find((x) => x.clientId === remoteId)
          if (p?.status === 'connecting' && !p.stream) {
            return prev.map((x) =>
              x.clientId === remoteId ? { ...x, status: 'failed' as const } : x,
            )
          }
          return prev
        })
      }, 20000)
    },
    [sendSignal, attachRemoteStream, updateRemote],
  )

  const connectToMember = useCallback(
    (member: MemberInfo, stream: MediaStream | null) => {
      if (member.clientId === clientId) return
      addRemotePlaceholder(member)
      createPeer(member.clientId, shouldInitiate(clientId, member.clientId), stream)
    },
    [clientId, addRemotePlaceholder, createPeer],
  )

  const flushPendingSignals = useCallback(
    (remoteId: string) => {
      const queued = pendingSignalsRef.current.get(remoteId)
      if (!queued?.length) return
      pendingSignalsRef.current.delete(remoteId)
      const peer = peersRef.current.get(remoteId)
      if (!peer) return
      for (const data of queued) {
        peer.signal(data)
      }
    },
    [],
  )

  const handleSignal = useCallback(
    (from: string, data: unknown) => {
      const signalData = data as Peer.SignalData

      if (!localStreamRef.current) {
        const queue = pendingSignalsRef.current.get(from) ?? []
        queue.push(signalData)
        pendingSignalsRef.current.set(from, queue)
        return
      }

      let peer = peersRef.current.get(from)
      if (!peer) {
        const nickname = memberNicknamesRef.current.get(from) ?? from.slice(0, 8)
        addRemotePlaceholder({ clientId: from, nickname, joinedAt: Date.now() })
        // 상대가 먼저 보낸 offer를 받은 경우 — answerer로 연결
        createPeer(from, false, localStreamRef.current)
        peer = peersRef.current.get(from)
      }

      peer?.signal(signalData)
      flushPendingSignals(from)
    },
    [clientId, addRemotePlaceholder, createPeer, flushPendingSignals],
  )

  const replaceOutgoingVideoTrack = useCallback(async (newStream: MediaStream | null) => {
    const videoTrack = newStream?.getVideoTracks()[0] ?? null
    peersRef.current.forEach((peer) => {
      const pc = (peer as Peer.Instance & { _pc?: RTCPeerConnection })._pc
      if (!pc) return
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
      if (sender && videoTrack) void sender.replaceTrack(videoTrack)
      else if (sender && !videoTrack) void sender.replaceTrack(null)
    })
  }, [])

  useEffect(() => {
    if (!localStream) return
    peersRef.current.forEach((peer) => {
      const pc = (peer as Peer.Instance & { _pc?: RTCPeerConnection })._pc
      if (!pc) return
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
      const track = localStream.getVideoTracks()[0]
      if (sender && track) void sender.replaceTrack(track)
    })
  }, [localStream])

  const toggleCamera = useCallback(() => {
    const stream = isScreenSharing ? screenStreamRef.current : cameraStreamRef.current
    const track = stream?.getVideoTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setCameraEnabled(track.enabled)
  }, [isScreenSharing])

  const toggleMic = useCallback(() => {
    const track = cameraStreamRef.current?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setMicEnabled(track.enabled)
  }, [])

  const stopScreenShareRef = useRef<() => Promise<void>>(async () => {})

  const stopScreenShare = useCallback(async () => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null
    const cam = cameraStreamRef.current
    if (cam) {
      await replaceOutgoingVideoTrack(cam)
      setCameraEnabled(cam.getVideoTracks()[0]?.enabled ?? true)
    } else {
      await replaceOutgoingVideoTrack(null)
    }
    setIsScreenSharing(false)
  }, [replaceOutgoingVideoTrack])

  stopScreenShareRef.current = stopScreenShare

  const startScreenShare = useCallback(async () => {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true })
      screenStreamRef.current = screen
      screen.getVideoTracks()[0]?.addEventListener('ended', () => {
        void stopScreenShareRef.current()
      })
      await replaceOutgoingVideoTrack(screen)
      setIsScreenSharing(true)
      setCameraEnabled(true)
    } catch {
      // cancelled
    }
  }, [replaceOutgoingVideoTrack])

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) await stopScreenShare()
    else await startScreenShare()
  }, [isScreenSharing, stopScreenShare, startScreenShare])

  const cleanup = useCallback(() => {
    peersRef.current.forEach((p) => {
      p.removeAllListeners()
      p.destroy()
    })
    peersRef.current.clear()
    pendingSignalsRef.current.clear()
    memberNicknamesRef.current.clear()
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null
    releaseCameraStream()
    cameraStreamRef.current = null
    setRemotePeers([])
  }, [])

  const syncMembers = useCallback(
    (members: MemberInfo[]) => {
      if (!localStreamRef.current) return

      members.forEach((m) => {
        memberNicknamesRef.current.set(m.clientId, m.nickname)
      })

      const stream = localStreamRef.current
      members.forEach((m) => {
        if (m.clientId !== clientId && !peersRef.current.has(m.clientId)) {
          connectToMember(m, stream)
        }
      })

      const memberIds = new Set(members.map((m) => m.clientId))
      peersRef.current.forEach((_, id) => {
        if (id !== clientId && !memberIds.has(id)) destroyPeer(id)
      })

      // 카메라 준비 전에 큐에 쌓인 시그널 처리
      for (const remoteId of peersRef.current.keys()) {
        flushPendingSignals(remoteId)
      }
      for (const [remoteId, signals] of pendingSignalsRef.current.entries()) {
        if (signals.length > 0 && !peersRef.current.has(remoteId)) {
          const nickname = memberNicknamesRef.current.get(remoteId) ?? remoteId.slice(0, 8)
          addRemotePlaceholder({ clientId: remoteId, nickname, joinedAt: Date.now() })
          const initiator = isOfferSignal(signals[0])
            ? false
            : shouldInitiate(clientId, remoteId)
          createPeer(remoteId, initiator, stream)
          flushPendingSignals(remoteId)
        }
      }
    },
    [clientId, connectToMember, destroyPeer, flushPendingSignals, addRemotePlaceholder, createPeer],
  )

  const retryPeer = useCallback(
    (peerId: string) => {
      const member = remotePeers.find((p) => p.clientId === peerId)
      if (!member || !localStreamRef.current) return
      destroyPeer(peerId)
      connectToMember(
        { clientId: peerId, nickname: member.nickname, joinedAt: Date.now() },
        localStreamRef.current,
      )
    },
    [remotePeers, destroyPeer, connectToMember],
  )

  return {
    cameraEnabled,
    micEnabled,
    isScreenSharing,
    remotePeers,
    connectToMember,
    handleSignal,
    syncMembers,
    destroyPeer,
    retryPeer,
    cleanup,
    toggleCamera,
    toggleMic,
    toggleScreenShare,
  }
}
