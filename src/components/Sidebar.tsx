import { useState } from 'react'
import PomodoroTimer from './PomodoroTimer'
import ChatPanel from './ChatPanel'
import { isMobile } from '../lib/constants'
import type { ChatMessage, SyncTimerState, TimerCommand } from '../lib/signaling'

export interface ToolsPanelProps {
  roomId: string
  hasPassword: boolean
  cameraEnabled: boolean
  micEnabled: boolean
  isScreenSharing: boolean
  isHost: boolean
  chatMessages: ChatMessage[]
  timerState: SyncTimerState | null
  onToggleCamera: () => void
  onToggleMic: () => void
  onToggleScreenShare: () => void
  onLeave: () => void
  onFocusComplete: (minutes: number) => void
  onSendChat: (text: string) => void
  onTimerCommand: (cmd: TimerCommand) => void
  onAction?: () => void
}

function ToolsPanel({
  roomId,
  hasPassword,
  cameraEnabled,
  micEnabled,
  isScreenSharing,
  isHost,
  chatMessages,
  timerState,
  onToggleCamera,
  onToggleMic,
  onToggleScreenShare,
  onLeave,
  onFocusComplete,
  onSendChat,
  onTimerCommand,
  onAction,
}: ToolsPanelProps) {
  const [toast, setToast] = useState<string | null>(null)
  const mobile = isMobile()

  const withClose = (fn: () => void) => () => {
    fn()
    onAction?.()
  }

  const copyLink = async () => {
    const url = `${window.location.origin}/room/${roomId}`
    try {
      await navigator.clipboard.writeText(url)
      const hint = hasPassword ? ' (비밀번호는 별도 공유)' : ''
      setToast(`링크가 복사되었습니다${hint}`)
    } catch {
      setToast('복사에 실패했습니다')
    }
    setTimeout(() => setToast(null), 2500)
    onAction?.()
  }

  return (
    <div className="flex flex-col gap-4">
      <PomodoroTimer
        syncMode
        isHost={isHost}
        timerState={timerState}
        onTimerCommand={onTimerCommand}
        onFocusComplete={onFocusComplete}
      />

      <ChatPanel messages={chatMessages} onSend={onSendChat} onAction={onAction} />

      <div className="flex flex-col gap-2 rounded-xl bg-slate-900/80 p-4 ring-1 ring-slate-800">
        {!mobile && (
          <button
            type="button"
            onClick={withClose(onToggleScreenShare)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              isScreenSharing
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            {isScreenSharing ? '화면 공유 중지' : '화면 공유'}
          </button>
        )}

        <button
          type="button"
          onClick={withClose(onToggleCamera)}
          className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-700"
        >
          카메라 {cameraEnabled ? '끄기' : '켜기'}
        </button>

        <button
          type="button"
          onClick={withClose(onToggleMic)}
          className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-700"
        >
          마이크 {micEnabled ? '끄기' : '켜기'}
        </button>

        <button
          type="button"
          onClick={copyLink}
          className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-700"
        >
          방 링크 복사
        </button>

        <button
          type="button"
          onClick={withClose(onLeave)}
          className="rounded-lg bg-red-900/60 px-3 py-2 text-sm font-medium text-red-200 transition hover:bg-red-900"
        >
          나가기
        </button>
      </div>

      {toast && (
        <p className="rounded-lg bg-emerald-950 px-3 py-2 text-center text-sm text-emerald-400 ring-1 ring-emerald-800">
          {toast}
        </p>
      )}
    </div>
  )
}

type SidebarProps = ToolsPanelProps

export default function Sidebar(props: SidebarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const mobile = isMobile()

  if (!mobile) {
    return (
      <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-72">
        <ToolsPanel {...props} />
      </aside>
    )
  }

  return (
    <>
      <div className="h-16 shrink-0 lg:hidden" aria-hidden />

      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-medium text-white shadow-lg hover:bg-emerald-500 lg:hidden"
      >
        몰입 도구
      </button>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="닫기"
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-slate-950 p-4 ring-1 ring-slate-800">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-slate-300">몰입 도구</h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800"
              >
                닫기
              </button>
            </div>
            <ToolsPanel {...props} onAction={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
