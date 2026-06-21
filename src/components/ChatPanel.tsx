import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../lib/signaling'

interface ChatPanelProps {
  messages: ChatMessage[]
  onSend: (text: string) => void
  onAction?: () => void
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatPanel({ messages, onSend, onAction }: ChatPanelProps) {
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
    onAction?.()
  }

  return (
    <div className="flex flex-col rounded-xl bg-slate-900/80 ring-1 ring-slate-800">
      <div className="border-b border-slate-800 px-3 py-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-slate-400">채팅</h3>
      </div>

      <div className="flex max-h-48 flex-col gap-2 overflow-y-auto p-3 lg:max-h-56">
        {messages.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-500">첫 메시지를 남겨보세요</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="text-sm">
              <span className="font-medium text-emerald-400">{msg.nickname}</span>
              <span className="ml-2 text-xs text-slate-600">{formatTime(msg.sentAt)}</span>
              <p className="mt-0.5 break-words text-slate-300">{msg.text}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-800 p-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="메시지 입력..."
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-emerald-500 focus:ring-2"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          전송
        </button>
      </form>
    </div>
  )
}
