import { isLiveStream } from './media'

let activeStream: MediaStream | null = null

export function setActiveCameraStream(stream: MediaStream): void {
  activeStream = stream
}

export function getActiveCameraStream(): MediaStream | null {
  if (!isLiveStream(activeStream)) {
    activeStream = null
    return null
  }
  return activeStream
}

export function releaseCameraStream(): void {
  activeStream?.getTracks().forEach((t) => t.stop())
  activeStream = null
}

export function prepareCameraStream(stream: MediaStream): MediaStream {
  stream.getAudioTracks().forEach((t) => {
    t.enabled = false
  })
  return stream
}

export function stashCameraStream(stream: MediaStream): void {
  setActiveCameraStream(stream)
}

export function takeCameraStream(): MediaStream | null {
  return getActiveCameraStream()
}

export function retainCameraStream(stream: MediaStream): void {
  setActiveCameraStream(stream)
}

export function getRetainedCameraStream(): MediaStream | null {
  return getActiveCameraStream()
}

export function attachExistingStream(): MediaStream | null {
  return getActiveCameraStream()
}

export function prepareHandoffStream(stream: MediaStream): MediaStream {
  return prepareCameraStream(stream)
}

export function tryBeginCameraInit(): boolean {
  return true
}

export function endCameraInit(): void {}
