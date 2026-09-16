import type { TypologyType } from '~/schemas/accommodations/typology'
import type { Diff } from './accommodation-diff'

/**
 * Diff des typologies pour les journaux d'activité.
 *
 * Les typologies vivent dans `accommodation_typology` et sortent donc du périmètre de
 * computeDiff, qui ne compare que les colonnes de `accommodation`. Sans ce calcul, les
 * modifications de disponibilités, de surfaces, de loyers et de nombre de logements
 * n'apparaîtraient pas dans le journal.
 *
 * Les clés émises sont `typologies.<type>.<champ>`. Les entrées antérieures portent les anciens
 * noms de colonnes plates (`nbT1Available`…) ; les deux conventions se résolvent vers le même
 * libellé côté affichage (voir utils/activity-fields.ts).
 */

const TRACKED_FIELDS = ['nbTotal', 'nbAvailable', 'priceMin', 'priceMax', 'superficieMin', 'superficieMax', 'colocation'] as const

type TrackedField = (typeof TRACKED_FIELDS)[number]

export type TypologySnapshot = { type: TypologyType } & Partial<Record<TrackedField, number | boolean | null>>

export const typologyDiffKey = (type: TypologyType, field: TrackedField | 'present') => `typologies.${type}.${field}`

/**
 * Compare deux jeux de typologies indexés par type.
 *
 * - une typologie ajoutée ou supprimée émet `typologies.<type>.present` en plus de ses champs,
 *   afin qu'une typologie entièrement vide ne disparaisse pas silencieusement du journal ;
 * - `null` et `undefined` sont équivalents : une donnée absente reste absente.
 */
export function computeTypologyDiff(before: TypologySnapshot[], after: TypologySnapshot[]): Diff {
  const beforeByType = new Map(before.map((t) => [t.type, t]))
  const afterByType = new Map(after.map((t) => [t.type, t]))
  const types = [...new Set([...beforeByType.keys(), ...afterByType.keys()])]

  const diff: Diff = {}
  for (const type of types) {
    const b = beforeByType.get(type)
    const a = afterByType.get(type)

    if (!!b !== !!a) {
      diff[typologyDiffKey(type, 'present')] = { old: !!b, new: !!a }
    }

    for (const field of TRACKED_FIELDS) {
      const oldVal = b?.[field] ?? null
      const newVal = a?.[field] ?? null
      if (oldVal !== newVal) diff[typologyDiffKey(type, field)] = { old: oldVal, new: newVal }
    }
  }
  return diff
}
