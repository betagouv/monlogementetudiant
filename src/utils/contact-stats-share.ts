export const contactStatsShare = (count: number, received: number): number | null =>
  received > 0 ? Math.round((count / received) * 100) : null
