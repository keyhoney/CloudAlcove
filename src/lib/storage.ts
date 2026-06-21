export interface StudyLog {
  date: string
  focusMinutes: number
}

export interface UserPrefs {
  nickname: string
  lastRoomId?: string
}

const PREFS_KEY = 'cloudalcove:prefs'
const LOG_KEY = 'cloudalcove:studyLog'

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function loadPrefs(): UserPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { nickname: '' }
    return JSON.parse(raw) as UserPrefs
  } catch {
    return { nickname: '' }
  }
}

export function savePrefs(prefs: UserPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

export function loadStudyLogs(): StudyLog[] {
  try {
    const raw = localStorage.getItem(LOG_KEY)
    if (!raw) return []
    return JSON.parse(raw) as StudyLog[]
  } catch {
    return []
  }
}

export function getTodayFocusMinutes(): number {
  const today = todayKey()
  const log = loadStudyLogs().find((l) => l.date === today)
  return log?.focusMinutes ?? 0
}

export function addFocusMinutes(minutes: number): void {
  const today = todayKey()
  const logs = loadStudyLogs()
  const idx = logs.findIndex((l) => l.date === today)
  if (idx >= 0) {
    logs[idx] = { ...logs[idx], focusMinutes: logs[idx].focusMinutes + minutes }
  } else {
    logs.push({ date: today, focusMinutes: minutes })
  }
  localStorage.setItem(LOG_KEY, JSON.stringify(logs))
}

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}시간 ${String(m).padStart(2, '0')}분`
}

export function isValidNickname(nickname: string): boolean {
  const trimmed = nickname.trim()
  return trimmed.length >= 2 && trimmed.length <= 12
}
