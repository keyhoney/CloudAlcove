import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { generateRoomId, normalizeRoomId } from '../lib/roomId'
import { loadPrefs, savePrefs, isValidNickname } from '../lib/storage'
import { isValidRoomPassword, normalizePassword } from '../lib/password'
import { useStudyLog } from '../hooks/useStudyLog'
import { isSecureContext, hasTurnServer } from '../lib/constants'
import { getBrowserSupportMessage } from '../lib/browser'
import Banner from '../components/Banner'

export default function Dashboard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { todayFormatted } = useStudyLog()
  const [nickname, setNickname] = useState('')
  const [joinId, setJoinId] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [joinPassword, setJoinPassword] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setNickname(loadPrefs().nickname)
  }, [])

  useEffect(() => {
    const room = searchParams.get('room')
    if (room) {
      setJoinId(normalizeRoomId(room))
    }
  }, [searchParams])

  const persistNickname = (value: string) => {
    setNickname(value)
    savePrefs({ ...loadPrefs(), nickname: value.trim() })
  }

  const validateNickname = (): boolean => {
    if (!isValidNickname(nickname)) {
      setError('닉네임은 2~12자로 입력해 주세요.')
      return false
    }
    return true
  }

  const validatePassword = (password: string, required: boolean): boolean => {
    if (!password && !required) return true
    if (!isValidRoomPassword(password)) {
      setError('비밀번호는 4~16자이거나 비워두세요.')
      return false
    }
    return true
  }

  const goToRoom = (path: string, password: string) => {
    if (!validateNickname()) return
    setError(null)
    savePrefs({ nickname: nickname.trim() })
    navigate(path, { state: { password } })
  }

  const handleCreate = () => {
    if (!validateNickname()) return
    if (usePassword && !validatePassword(createPassword, true)) return
    if (usePassword && !createPassword.trim()) {
      setError('비밀번호를 입력하거나 체크를 해제하세요.')
      return
    }
    const roomId = generateRoomId()
    const password = usePassword ? normalizePassword(createPassword) : ''
    goToRoom(`/room/${roomId}?host=1`, password)
  }

  const handleJoin = () => {
    const id = joinId.trim().toUpperCase()
    if (!validateNickname()) return
    if (id.length !== 6) {
      setError('Room ID는 6자리입니다.')
      return
    }
    if (!validatePassword(joinPassword, false)) return
    goToRoom(`/room/${id}`, normalizePassword(joinPassword))
  }

  const browserWarning = getBrowserSupportMessage()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md space-y-8">
        <header className="text-center">
          <div className="mb-2 text-4xl">☁️</div>
          <h1 className="text-3xl font-bold tracking-tight text-white">CloudAlcove</h1>
          <p className="mt-2 text-sm text-slate-400">로그인 없이, 링크만으로 함께하는 온라인 독서실</p>
        </header>

        {browserWarning && <Banner message={browserWarning} />}

        {!isSecureContext() && (
          <div className="rounded-lg bg-amber-950/50 px-4 py-3 text-sm text-amber-300 ring-1 ring-amber-800">
            보안 연결(HTTPS)이 필요합니다. 카메라를 사용하려면 HTTPS로 접속하세요.
          </div>
        )}

        {hasTurnServer() && (
          <p className="text-center text-xs text-slate-600">TURN 서버 활성화됨 — P2P 연결 안정성 향상</p>
        )}

        <p className="text-center text-sm text-slate-500">
          오늘 나의 누적 몰입 시간:{' '}
          <span className="font-medium text-emerald-400">{todayFormatted}</span>
        </p>

        <div className="space-y-4 rounded-2xl bg-slate-900/60 p-6 ring-1 ring-slate-800">
          <div>
            <label htmlFor="nickname" className="mb-1 block text-sm text-slate-400">
              닉네임
            </label>
            <input
              id="nickname"
              type="text"
              maxLength={12}
              value={nickname}
              onChange={(e) => persistNickname(e.target.value)}
              placeholder="2~12자"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={usePassword}
              onChange={(e) => setUsePassword(e.target.checked)}
              className="rounded border-slate-600 bg-slate-950 text-emerald-600"
            />
            방 비밀번호 설정 (선택)
          </label>

          {usePassword && (
            <div>
              <label htmlFor="createPassword" className="mb-1 block text-sm text-slate-400">
                비밀번호 (4~16자)
              </label>
              <input
                id="createPassword"
                type="password"
                maxLength={16}
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="친구에게 따로 알려주세요"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleCreate}
            className="w-full rounded-lg bg-emerald-600 py-3 font-medium text-white transition hover:bg-emerald-500"
          >
            방 만들기
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-2 text-slate-500">또는</span>
            </div>
          </div>

          <div>
            <label htmlFor="roomId" className="mb-1 block text-sm text-slate-400">
              Room ID (6자리)
            </label>
            <input
              id="roomId"
              type="text"
              maxLength={6}
              value={joinId}
              onChange={(e) => setJoinId(e.target.value.toUpperCase())}
              placeholder="ABC123"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono uppercase text-white outline-none ring-emerald-500 focus:ring-2"
            />
          </div>

          <div>
            <label htmlFor="joinPassword" className="mb-1 block text-sm text-slate-400">
              방 비밀번호 (있는 경우)
            </label>
            <input
              id="joinPassword"
              type="password"
              maxLength={16}
              value={joinPassword}
              onChange={(e) => setJoinPassword(e.target.value)}
              placeholder="비밀번호 없으면 비워두세요"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-emerald-500 focus:ring-2"
            />
          </div>

          <button
            type="button"
            onClick={handleJoin}
            className="w-full rounded-lg bg-slate-800 py-3 font-medium text-slate-100 transition hover:bg-slate-700"
          >
            방 참여하기
          </button>
        </div>
      </div>
    </div>
  )
}
