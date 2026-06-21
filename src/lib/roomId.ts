const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRoomId(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join('')
}

export function isValidRoomId(id: string): boolean {
  return /^[A-Z2-9]{6}$/.test(id.toUpperCase())
}

export function normalizeRoomId(id: string): string {
  return id.trim().toUpperCase()
}

export function generateClientId(): string {
  return crypto.randomUUID()
}
