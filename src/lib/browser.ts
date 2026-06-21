export function isWebRTCSupported(): boolean {
  return (
    typeof RTCPeerConnection !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  )
}

export function getBrowserSupportMessage(): string | null {
  if (!isWebRTCSupported()) {
    return '이 브라우저는 WebRTC를 지원하지 않습니다. Chrome, Edge, Safari 15+ 사용을 권장합니다.'
  }
  return null
}
