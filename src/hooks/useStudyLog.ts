import { useCallback, useEffect, useState } from 'react'
import { getTodayFocusMinutes, addFocusMinutes, formatMinutes } from '../lib/storage'

export function useStudyLog() {
  const [todayMinutes, setTodayMinutes] = useState(getTodayFocusMinutes)

  const refresh = useCallback(() => {
    setTodayMinutes(getTodayFocusMinutes())
  }, [])

  const recordFocus = useCallback((minutes: number) => {
    addFocusMinutes(minutes)
    setTodayMinutes(getTodayFocusMinutes())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    todayMinutes,
    todayFormatted: formatMinutes(todayMinutes),
    recordFocus,
    refresh,
  }
}
