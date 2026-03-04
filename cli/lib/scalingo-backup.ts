import { createWriteStream } from 'fs'
import { mkdir } from 'fs/promises'
import path from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'

interface Backup {
  id: string
  name: string
  created_at: string
  size: number
  status: string
}

export class ScalingoBackupService {
  private bearerToken = ''
  private addonToken = ''
  private readonly apiToken: string
  private readonly appName: string
  private readonly addonId: string
  private readonly region: string

  constructor() {
    const apiToken = process.env.SCALINGO_API_TOKEN
    const appName = process.env.SCALINGO_APP
    const addonId = process.env.SCALINGO_DB_ADDON_ID
    const region = process.env.SCALINGO_REGION || 'osc-secnum-fr1'

    if (!apiToken || !appName || !addonId) {
      throw new Error('Missing required env vars: SCALINGO_API_TOKEN, SCALINGO_APP, SCALINGO_DB_ADDON_ID')
    }

    this.apiToken = apiToken
    this.appName = appName
    this.addonId = addonId
    this.region = region
  }

  async authenticate(): Promise<void> {
    // Step 1: Exchange API token for bearer token
    const exchangeRes = await fetch('https://auth.scalingo.com/v1/tokens/exchange', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`:${this.apiToken}`).toString('base64')}`,
      },
    })
    if (!exchangeRes.ok) {
      throw new Error(`Token exchange failed: ${exchangeRes.status} ${await exchangeRes.text()}`)
    }
    const { token } = (await exchangeRes.json()) as { token: string }
    this.bearerToken = token

    // Step 2: Get addon token (POST to /token endpoint)
    const addonRes = await fetch(`https://api.${this.region}.scalingo.com/v1/apps/${this.appName}/addons/${this.addonId}/token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.bearerToken}` },
    })
    if (!addonRes.ok) {
      throw new Error(`Addon fetch failed: ${addonRes.status} ${await addonRes.text()}`)
    }
    const { addon } = (await addonRes.json()) as { addon: { token: string } }
    this.addonToken = addon.token
  }

  async listBackups(): Promise<Backup[]> {
    const res = await fetch(`https://db-api.${this.region}.scalingo.com/api/databases/${this.addonId}/backups`, {
      headers: { Authorization: `Bearer ${this.addonToken}` },
    })
    if (!res.ok) {
      throw new Error(`List backups failed: ${res.status} ${await res.text()}`)
    }
    const { database_backups } = (await res.json()) as { database_backups: Backup[] }
    return database_backups
  }

  async downloadLatestBackup(destDir: string): Promise<string> {
    const backups = await this.listBackups()

    const latest = backups
      .filter((b) => b.status === 'done')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    if (!latest) {
      throw new Error('✗ Aucun backup terminé trouvé')
    }

    console.log(`✓ Dernier backup trouvé : ${latest.name || latest.id} - ${new Date(latest.created_at).toLocaleString('fr-FR')}`)

    // Get download URL
    console.log("→ Génération de l'URL de téléchargement...")
    const archiveRes = await fetch(
      `https://db-api.${this.region}.scalingo.com/api/databases/${this.addonId}/backups/${latest.id}/archive`,
      { headers: { Authorization: `Bearer ${this.addonToken}` } },
    )
    if (!archiveRes.ok) {
      throw new Error(`Archive URL fetch failed: ${archiveRes.status} ${await archiveRes.text()}`)
    }
    const { download_url } = (await archiveRes.json()) as { download_url: string }
    console.log('✓ URL de téléchargement obtenue')

    // Download the archive
    console.log(`→ Téléchargement du backup (${(latest.size / 1024 / 1024).toFixed(1)} MB)...`)
    const downloadRes = await fetch(download_url)
    if (!downloadRes.ok || !downloadRes.body) {
      throw new Error(`✗ Download failed: ${downloadRes.status}`)
    }

    await mkdir(destDir, { recursive: true })
    const destPath = path.join(destDir, 'backup.tar.gz')
    const fileStream = createWriteStream(destPath)
    await pipeline(Readable.fromWeb(downloadRes.body as never), fileStream)

    console.log(`✓ Backup téléchargé : ${destPath}`)
    return destPath
  }
}
