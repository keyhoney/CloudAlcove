import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BREAK_SECONDS,
  FOCUS_SECONDS,
  playNotificationSound,
  resolveSyncedSeconds,
} from '../lib/constants'
import type { SyncTimerState, TimerCommand } from '../lib/signaling'

interface PomodoroTimerProps {
  onFocusComplete?: (minutes: number) => void
  syncMode?: boolean
  isHost?: boolean
  timerState?: SyncTimerState | null
  onTimerCommand?: (cmd: TimerCommand) => void
}

export default function PomodoroTimer({
  onFocusComplete,
  syncMode = false,
  isHost = false,
  timerState = null,
  onTimerCommand,
}: PomodoroTimerProps) {
  const [phase, setPhase] = useState<'focus' | 'break'>('focus')
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_SECONDS)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<number | null>(null)
  const prevPhaseRef = useRef<'focus' | 'break'>('focus')
  const hostZeroSentRef = useRef(false)

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // --- 개인 타이머 (syncMode=false) ---
  useEffect(() => {
    if (syncMode) return

    if (!running) {
      clearTimer()
      return
    }

    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((s) => s - 1)
    }, 1000)

    return clearTimer
  }, [syncMode, running, clearTimer])

  useEffect(() => {
    if (syncMode) return
    if (secondsLeft > 0) return

    playNotificationSound()
    if (phase === 'focus') {
      onFocusComplete?.(25)
      setPhase('break')
      setSecondsLeft(BREAK_SECONDS)
    } else {
      setPhase('focus')
      setSecondsLeft(FOCUS_SECONDS)
    }
  }, [syncMode, secondsLeft, phase, onFocusComplete])

  // --- 동기화 타이머 ---
  useEffect(() => {
    if (!syncMode || !timerState) return

    const resolved = resolveSyncedSeconds(timerState)
    setPhase(timerState.phase)
    setSecondsLeft(resolved)
    setRunning(timerState.running)

    if (timerState.phase !== prevPhaseRef.current) {
      playNotificationSound()
      if (timerState.phase === 'break' && prevPhaseRef.current === 'focus') {
        onFocusComplete?.(25)
      }
      prevPhaseRef.current = timerState.phase
    }

    hostZeroSentRef.current = false
  }, [syncMode, timerState, onFocusComplete])

  useEffect(() => {
    if (!syncMode || !timerState) return

    clearTimer()
    intervalRef.current = window.setInterval(() => {
      const left = resolveSyncedSeconds(timerState)
      setSecondsLeft(left)

      if (isHost && timerState.running && left <= 0 && !hostZeroSentRef.current) {
        hostZeroSentRef.current = true
        onTimerCommand?.({ action: 'phase-complete' })
      }
    }, 1000)

    return clearTimer
  }, [syncMode, timerState, isHost, onTimerCommand, clearTimer])

  const toggle = () => {
    if (syncMode) {
      if (!isHost) return
      if (timerState?.running) {
        onTimerCommand?.({ action: 'pause' })
      } else {
        onTimerCommand?.({ action: 'start' })
      }
      return
    }
    setRunning((r) => !r)
  }

  const reset = () => {
    if (syncMode) {
      if (!isHost) return
      onTimerCommand?.({ action: 'reset' })
      return
    }
    setRunning(false)
    setPhase('focus')
    setSecondsLeft(FOCUS_SECONDS)
  }

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const hostControls = !syncMode || isHost

  if (syncMode && !timerState) {
    return (
      <div className="rounded-xl bg-slate-900/80 p-4 ring-1 ring-slate-800">
        <p className="text-sm text-slate-500">타이머 동기화 중...</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-slate-900/80 p-4 ring-1 ring-slate-800">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">
          {phase === 'focus' ? '집중' : '휴식'}
        </p>
        {syncMode && (
          <span className="text-xs text-slate-500">
            {isHost ? '동기화 · 방장' : '동기화 · 따라가기'}
          </span>
        )}
      </div>
      <p className="mb-4 font-mono text-4xl tabular-nums text-slate-100">
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={syncMode && !isHost}
          className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {!hostControls ? '방장 타이머' : running ? '일시정지' : '시작'}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={syncMode && !isHost}
          className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          리셋
        </button>
      </div>
    </div>
  )
}
