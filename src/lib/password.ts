export function isValidRoomPassword(password: string): boolean {
  const trimmed = password.trim()
  return trimmed.length === 0 || (trimmed.length >= 4 && trimmed.length <= 16)
}

export function normalizePassword(password: string): string {
  return password.trim()
}
