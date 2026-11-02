export type TDonutSlice<T> = { key: T; path: string }

const point = (cx: number, cy: number, radius: number, angle: number) => ({
  x: cx + radius * Math.cos(angle),
  y: cy + radius * Math.sin(angle),
})

const round = (value: number) => Math.round(value * 1000) / 1000

export const donutArcPath = (cx: number, cy: number, outer: number, inner: number, start: number, end: number) => {
  const largeArc = end - start > Math.PI ? 1 : 0
  const a = point(cx, cy, outer, start)
  const b = point(cx, cy, outer, end)
  const c = point(cx, cy, inner, end)
  const d = point(cx, cy, inner, start)
  return [
    `M ${round(a.x)} ${round(a.y)}`,
    `A ${outer} ${outer} 0 ${largeArc} 1 ${round(b.x)} ${round(b.y)}`,
    `L ${round(c.x)} ${round(c.y)}`,
    `A ${inner} ${inner} 0 ${largeArc} 0 ${round(d.x)} ${round(d.y)}`,
    'Z',
  ].join(' ')
}

export const donutSlices = <T>(
  shares: { key: T; share: number }[],
  { cx, cy, outer, inner }: { cx: number; cy: number; outer: number; inner: number },
): TDonutSlice<T>[] => {
  const slices: TDonutSlice<T>[] = []
  let start = -Math.PI / 2
  for (const { key, share } of shares) {
    if (share <= 0) continue
    const sweep = Math.min(share, 1) * 2 * Math.PI
    if (sweep >= 2 * Math.PI - 1e-6) {
      const middle = start + Math.PI
      slices.push({
        key,
        path: `${donutArcPath(cx, cy, outer, inner, start, middle)} ${donutArcPath(cx, cy, outer, inner, middle, start + 2 * Math.PI)}`,
      })
    } else {
      slices.push({ key, path: donutArcPath(cx, cy, outer, inner, start, start + sweep) })
    }
    start += sweep
  }
  return slices
}
