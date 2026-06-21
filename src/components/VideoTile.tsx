import { useEffect, useRef } from 'react'
import { attachStreamToVideo } from '../lib/media'

interface VideoTileProps {
  nickname: string
  stream: MediaStream | null
  isLocal?: boolean
  placeholder?: string
  status?: 'connecting' | 'connected' | 'failed'
  isScreenSharing?: boolean
  onRetry?: () => void
}

export default function VideoTile({
  nickname,
  stream,
  isLocal = false,
  placeholder,
  status,
  isScreenSharing = false,
  onRetry,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hasStream = Boolean(stream?.getVideoTracks()[0])
  const showPlaceholder = !hasStream || (!isLocal && status === 'failed')

  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream || !hasStream) return
    attachStreamToVideo(video, stream)
  }, [stream, hasStream])

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-slate-800">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`h-full w-full object-cover ${showPlaceholder ? 'hidden' : ''}`}
      />

      {showPlaceholder && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900 px-4 text-slate-400">
          <span className="text-2xl">{status === 'failed' ? '⚠️' : '📚'}</span>
          <p className="text-center text-sm">
            {status === 'connecting'
              ? '연결 중...'
              : status === 'failed'
                ? '연결 실패'
                : placeholder ?? '공부 중...'}
          </p>
          {status === 'failed' && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
            >
              다시 연결
            </button>
          )}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
        <span className="truncate text-sm font-medium text-white">{nickname}</span>
        {isLocal && isScreenSharing && (
          <span className="rounded bg-emerald-600/80 px-1.5 py-0.5 text-xs text-white">화면 공유</span>
        )}
      </div>
    </div>
  )
}
