export const floorToStep = (value: number, step: number) => {
  if (!Number.isFinite(value) || value <= 0 || step <= 0) return 0
  return Math.floor(value / step) * step
}
