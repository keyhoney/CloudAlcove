interface BannerProps {
  message: string
  variant?: 'warning' | 'info'
}

export default function Banner({ message, variant = 'warning' }: BannerProps) {
  const styles =
    variant === 'warning'
      ? 'bg-amber-950/50 text-amber-300 ring-amber-800'
      : 'bg-slate-900 text-slate-400 ring-slate-800'

  return (
    <div className={`px-4 py-2 text-center text-sm ring-1 ${styles}`}>{message}</div>
  )
}
