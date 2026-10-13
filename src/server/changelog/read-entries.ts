import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { type TChangelogEntry, ZChangelogEntry } from '~/schemas/changelog/changelog-entry'

const CHANGELOG_DIR = path.join(process.cwd(), 'changelog')

/** Sépare le frontmatter (clés `key: value`) du corps markdown. */
function splitFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/)
  if (!match) return { data: {}, body: raw.trim() }

  const data: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (key) data[key] = value
  }
  return { data, body: match[2].trim() }
}

/** Le corps : première ligne `# Titre` → titre, le reste → description. */
function splitTitleAndDescription(body: string): { title: string; description: string } {
  const lines = body.split('\n')
  const firstNonEmpty = lines.findIndex((l) => l.trim() !== '')
  if (firstNonEmpty === -1) return { title: '', description: '' }

  const titleLine = lines[firstNonEmpty].trim()
  const title = titleLine.startsWith('#') ? titleLine.replace(/^#+\s*/, '') : titleLine
  const description = lines
    .slice(firstNonEmpty + 1)
    .join('\n')
    .trim()
  return { title, description }
}

/**
 * Parse un fichier de changelog. Fonction pure (testable sans filesystem).
 * Retourne `null` si l'entrée est malformée (champ manquant, valeur hors enum…).
 */
export function parseChangelogFile(raw: string, filename: string): TChangelogEntry | null {
  const slug = filename.replace(/\.md$/, '')
  const { data, body } = splitFrontmatter(raw)
  const { title, description } = splitTitleAndDescription(body)

  const result = ZChangelogEntry.safeParse({
    slug,
    type: data.type,
    perimetre: data.perimetre || undefined,
    date: data.date,
    title,
    description,
  })
  if (!result.success) {
    console.warn(`[changelog] entrée ignorée « ${filename} » : ${result.error.issues.map((i) => i.message).join(', ')}`)
    return null
  }
  return result.data
}

/** Lit toutes les entrées valides du dossier `changelog/`, triées de la plus récente à la plus ancienne. */
export async function readChangelogEntries(): Promise<TChangelogEntry[]> {
  let filenames: string[]
  try {
    filenames = (await readdir(CHANGELOG_DIR)).filter((f) => f.endsWith('.md') && f !== 'README.md')
  } catch {
    // Dossier absent (ne devrait pas arriver en prod) : on renvoie une liste vide plutôt que d'échouer.
    return []
  }

  const entries = await Promise.all(
    filenames.map(async (filename) => parseChangelogFile(await readFile(path.join(CHANGELOG_DIR, filename), 'utf-8'), filename)),
  )

  return entries.filter((e): e is TChangelogEntry => e !== null).sort((a, b) => b.date.localeCompare(a.date))
}
