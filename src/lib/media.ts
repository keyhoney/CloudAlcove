export function getMediaErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return '카메라 권한이 필요합니다. 주소창 왼쪽 🔒 → 사이트 설정 → 카메라「허용」으로 바꿔 주세요.'
      case 'NotFoundError':
        return '카메라를 찾을 수 없습니다. 웹캠 연결을 확인해 주세요.'
      case 'NotReadableError':
        return '카메라가 다른 앱(Zoom, Teams 등)에서 사용 중입니다.'
      case 'OverconstrainedError':
        return '카메라 설정을 지원하지 않습니다.'
      case 'AbortError':
        return '카메라 요청이 취소되었습니다. 다시 시도해 주세요.'
      default:
        return `카메라 오류: ${error.name}`
    }
  }
  return '카메라를 켤 수 없습니다.'
}

export async function acquireCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException('NotSupportedError', 'getUserMedia not supported')
  }

  const attempts: MediaStreamConstraints[] = [
    { video: { facingMode: 'user' }, audio: false },
    { video: true, audio: false },
    { video: true, audio: true },
  ]

  let lastError: unknown
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      lastError = err
      // 권한 거부면 다른 constraint로 재시도해도 소용없음
      if (err instanceof DOMException && err.name === 'NotAllowedError') break
    }
  }
  throw lastError
}

export async function queryCameraPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  try {
    const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
    return result.state as 'granted' | 'denied' | 'prompt'
  } catch {
    return 'unknown'
  }
}

export function attachStreamToVideo(video: HTMLVideoElement, stream: MediaStream): void {
  if (video.srcObject !== stream) {
    video.srcObject = stream
  }
  void video.play().catch(() => {
    // play() 실패 시에도 srcObject는 유지
  })
}

export function isLiveStream(stream: MediaStream | null): boolean {
  if (!stream) return false
  const track = stream.getVideoTracks()[0]
  return Boolean(track && track.readyState === 'live')
}
