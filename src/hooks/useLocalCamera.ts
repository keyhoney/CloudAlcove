import { useCallback, useRef, useState } from 'react'
import { acquireCameraStream, getMediaErrorMessage, isLiveStream } from '../lib/media'
import {
  prepareCameraStream,
  setActiveCameraStream,
  getActiveCameraStream,
  releaseCameraStream,
} from '../lib/mediaSession'

interface UseLocalCameraResult {
  localStream: MediaStream | null
  cameraError: string | null
  cameraRequesting: boolean
  cameraReady: boolean
  startCamera: () => Promise<MediaStream | null>
}

export function useLocalCamera(): UseLocalCameraResult {
  const [localStream, setLocalStream] = useState<MediaStream | null>(() => getActiveCameraStream())
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraRequesting, setCameraRequesting] = useState(false)
  const busyRef = useRef(false)

  const applyStream = useCallback((stream: MediaStream) => {
    prepareCameraStream(stream)
    setActiveCameraStream(stream)
    setLocalStream(stream)
    setCameraError(null)
    return stream
  }, [])

  const startCamera = useCallback(async (): Promise<MediaStream | null> => {
    if (busyRef.current) return getActiveCameraStream()

    const existing = getActiveCameraStream()
    if (isLiveStream(existing)) {
      setLocalStream(existing)
      setCameraError(null)
      return existing
    }

    busyRef.current = true
    setCameraRequesting(true)
    setCameraError(null)

    try {
      const stream = await acquireCameraStream()
      return applyStream(stream)
    } catch (err) {
      setCameraError(getMediaErrorMessage(err))
      setLocalStream(null)
      return null
    } finally {
      busyRef.current = false
      setCameraRequesting(false)
    }
  }, [applyStream])

  return {
    localStream,
    cameraError,
    cameraRequesting,
    cameraReady: isLiveStream(localStream),
    startCamera,
  }
}

export function releaseLocalCamera(): void {
  releaseCameraStream()
}
