import { z } from 'zod'
import { CHANGELOG_PERIMETERS, CHANGELOG_TYPES } from '~/enums/changelog'

/**
 * Entrée de changelog telle que lue depuis un fichier `changelog/*.md` (frontmatter + corps).
 * Données maîtrisées (versionnées dans le repo) mais validées pour détecter une entrée malformée.
 */
export const ZChangelogEntry = z.object({
  /** Nom de fichier sans extension, sert d'identifiant stable côté UI. */
  slug: z.string().min(1),
  type: z.enum(CHANGELOG_TYPES),
  perimetre: z.enum(CHANGELOG_PERIMETERS).optional(),
  /** Date de mise en production, au format AAAA-MM-JJ. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'La date doit être au format AAAA-MM-JJ' }),
  title: z.string().min(1),
  description: z.string().min(1),
})

export type TChangelogEntry = z.infer<typeof ZChangelogEntry>
