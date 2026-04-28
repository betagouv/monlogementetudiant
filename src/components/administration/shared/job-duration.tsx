type JobDurationProps = {
  startedAt: Date | string | null | undefined
  endedAt: Date | string | null | undefined
  className?: string
}

export function formatDuration(startedAt: JobDurationProps['startedAt'], endedAt: JobDurationProps['endedAt']): string | null {
  if (!startedAt || !endedAt) return null
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  if (ms < 0) return null
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

export function JobDuration({ startedAt, endedAt, className }: JobDurationProps) {
  const duration = formatDuration(startedAt, endedAt)
  if (!duration) return null
  return <span className={className}>{duration}</span>
}
