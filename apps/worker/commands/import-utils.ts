import type { ImportResultResidence } from '../types'

export function pushResidenceEntry(
  residences: ImportResultResidence[],
  entry: { name: string; slug: string; city: string | null; action: ImportResultResidence['action'] },
): void {
  residences.push(entry)
}
