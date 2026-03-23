import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { uploadFile } from '../../src/server/services/s3'

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'])

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    avif: 'image/avif',
  }
  return map[ext] ?? 'image/jpeg'
}

function generateKey(name: string, ext: string): string {
  const suffixDir = process.env.S3_SUFFIX_DIR ?? ''
  const uuidHex = randomUUID().replace(/-/g, '')
  return `accommodations${suffixDir}/${name}/pictures/${uuidHex}.${ext}`
}

export async function uploadImages(dir: string, opts: { name: string }) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`Le dossier "${dir}" n'existe pas`)
  }

  const name = opts.name.trim()
  if (!name) {
    throw new Error('Le paramètre --name est requis')
  }

  console.log(`Destination S3 : accommodations${process.env.S3_SUFFIX_DIR ?? ''}/${name}/pictures/\n`)

  const folders = fs
    .readdirSync(dir)
    .filter((f) => !f.startsWith('.') && fs.statSync(path.join(dir, f)).isDirectory())
    .sort()

  if (folders.length === 0) {
    console.log('Aucun sous-dossier trouvé.')
    return
  }

  console.log(`${folders.length} dossiers trouvés\n`)

  const results: Record<string, string[]> = {}

  for (const folder of folders) {
    const folderPath = path.join(dir, folder)
    const files = fs
      .readdirSync(folderPath)
      .filter((f) => {
        const ext = path.extname(f).replace('.', '').toLowerCase()
        return IMAGE_EXTENSIONS.has(ext) && !f.startsWith('.')
      })
      .sort()

    if (files.length === 0) {
      console.log(`${folder}: aucune image`)
      continue
    }

    console.log(`${folder}: ${files.length} images`)
    const urls: string[] = []

    for (const file of files) {
      const filePath = path.join(folderPath, file)
      const ext = path.extname(file).replace('.', '').toLowerCase()
      const buffer = fs.readFileSync(filePath)
      const key = generateKey(name, ext)
      const url = await uploadFile({ key, body: buffer, contentType: getMimeType(ext) })
      urls.push(url)
      console.log(`  ${file} -> ${url}`)
    }

    results[folder] = urls
  }

  console.log('\n--- Résultat (dossier | urls) ---\n')
  for (const [folder, urls] of Object.entries(results)) {
    console.log(`${folder}:`)
    console.log(urls.join('|'))
    console.log()
  }
}
