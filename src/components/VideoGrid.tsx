import VideoTile from './VideoTile'
import type { RemotePeer } from '../hooks/useWebRTC'

interface VideoGridProps {
  localNickname: string
  localStream: MediaStream | null
  remotePeers: RemotePeer[]
  isScreenSharing: boolean
  onRetryPeer?: (clientId: string) => void
}

export default function VideoGrid({
  localNickname,
  localStream,
  remotePeers,
  isScreenSharing,
  onRetryPeer,
}: VideoGridProps) {
  const total = 1 + remotePeers.length
  const gridClass =
    total <= 1 ? 'grid-cols-1' : total <= 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2'

  return (
    <div className={`grid ${gridClass} gap-4`}>
      <VideoTile
        nickname={`${localNickname} (나)`}
        stream={localStream}
        isLocal
        isScreenSharing={isScreenSharing}
        placeholder="공부 중..."
      />
      {remotePeers.map((peer) => (
        <VideoTile
          key={peer.clientId}
          nickname={peer.nickname}
          stream={peer.stream}
          status={peer.status}
          onRetry={onRetryPeer ? () => onRetryPeer(peer.clientId) : undefined}
        />
      ))}
    </div>
  )
}
