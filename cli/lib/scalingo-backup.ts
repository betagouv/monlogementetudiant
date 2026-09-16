import { createWriteStream } from 'fs'
import { mkdir } from 'fs/promises'
import path from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { z } from 'zod'
import { env } from '~/server/env'

/**
 * Réponses de l'API Scalingo. Schémas internes au service, non exportés : ils décrivent la forme
 * d'une API tierce, pas un objet du domaine. Seuls les champs qu'on lit sont déclarés — Zod
 * ignore le reste, ce qui évite de casser au moindre ajout côté Scalingo.
 */
const ZTokenExchange = z.object({ token: z.string() })
const ZAddonToken = z.object({ addon: z.object({ token: z.string() }) })

const ZAddonList = z.object({
  addons: z.array(
    z.object({
      id: z.string(),
      addon_provider: z.object({ id: z.string() }),
    }),
  ),
})

const ZBackup = z.object({
  id: z.string(),
  name: z.string().optional(),
  created_at: z.string(),
  size: z.number(),
  status: z.string(),
})

const ZBackupList = z.object({ database_backups: z.array(ZBackup) })
const ZBackupArchive = z.object({ download_url: z.url() })

export type TScalingoBackup = z.infer<typeof ZBackup>

/** Le dernier backup terminé, et l'URL signée pour le récupérer. */
export interface ScalingoBackupDownload {
  backup: TScalingoBackup
  downloadUrl: string
}

/**
 * Lit une réponse JSON de l'API Scalingo et la valide. Un échec de parsing est une erreur dure :
 * on préfère un cron en échec (donc un mail) à un backup construit sur une réponse qu'on n'a pas
 * comprise.
 */
async function parseJson<T>(response: Response, schema: z.ZodType<T>, context: string): Promise<T> {
  const result = schema.safeParse(await response.json())
  if (!result.success) {
    throw new Error(`Réponse Scalingo inattendue (${context}) : ${result.error.message}`)
  }
  return result.data
}

/** Identifiant du provider de l'addon PostgreSQL, tel que renvoyé par l'API Scalingo. */
const POSTGRESQL_PROVIDER_ID = 'postgresql'

export class ScalingoBackupService {
  private bearerToken = ''
  private addonToken = ''
  /** Résolu par `authenticate()` à partir de l'application — voir `resolveAddonId`. */
  private addonId = ''
  private readonly apiToken: string
  private readonly appName: string
  private readonly region: string

  constructor() {
    const { SCALINGO_API_TOKEN: apiToken, SCALINGO_APP: appName, SCALINGO_REGION: region } = env

    if (!apiToken || !appName) {
      throw new Error('Missing required env vars: SCALINGO_API_TOKEN, SCALINGO_APP')
    }

    this.apiToken = apiToken
    this.appName = appName
    this.region = region
  }

  /** Nom de l'application Scalingo interrogée — sert à nommer les objets déposés dans S3. */
  get app(): string {
    return this.appName
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
    const { token } = await parseJson(exchangeRes, ZTokenExchange, 'tokens/exchange')
    this.bearerToken = token

    // Step 2: Resolve the PostgreSQL addon of the app
    this.addonId = await this.resolveAddonId()

    // Step 3: Get addon token (POST to /token endpoint)
    const addonRes = await fetch(`https://api.${this.region}.scalingo.com/v1/apps/${this.appName}/addons/${this.addonId}/token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.bearerToken}` },
    })
    if (!addonRes.ok) {
      throw new Error(`Addon fetch failed: ${addonRes.status} ${await addonRes.text()}`)
    }
    const { addon } = await parseJson(addonRes, ZAddonToken, 'addons/token')
    this.addonToken = addon.token
  }

  /**
   * Identifiant de l'addon PostgreSQL de l'application.
   *
   * Déduit de `SCALINGO_APP` plutôt que configuré : c'est une propriété de l'app, pas un réglage à
   * tenir à jour au prochain changement d'addon. On filtre le JSON de l'API sur `addon_provider.id`.
   */
  private async resolveAddonId(): Promise<string> {
    const res = await fetch(`https://api.${this.region}.scalingo.com/v1/apps/${this.appName}/addons`, {
      headers: { Authorization: `Bearer ${this.bearerToken}` },
    })
    if (!res.ok) {
      throw new Error(`Addons list failed: ${res.status} ${await res.text()}`)
    }

    const { addons } = await parseJson(res, ZAddonList, 'addons')
    const postgres = addons.filter((addon) => addon.addon_provider.id === POSTGRESQL_PROVIDER_ID)

    if (postgres.length === 0) {
      throw new Error(`Aucun addon PostgreSQL sur l'application Scalingo « ${this.appName} ».`)
    }
    // Plusieurs bases sur la même app : on refuse d'en choisir une au hasard.
    if (postgres.length > 1) {
      throw new Error(
        `${postgres.length} addons PostgreSQL sur « ${this.appName} » (${postgres.map((a) => a.id).join(', ')}) : ` +
          'impossible de déterminer lequel sauvegarder.',
      )
    }

    return postgres[0].id
  }

  async listBackups(): Promise<TScalingoBackup[]> {
    const res = await fetch(`https://db-api.${this.region}.scalingo.com/api/databases/${this.addonId}/backups`, {
      headers: { Authorization: `Bearer ${this.addonToken}` },
    })
    if (!res.ok) {
      throw new Error(`List backups failed: ${res.status} ${await res.text()}`)
    }
    const { database_backups } = await parseJson(res, ZBackupList, 'backups')
    return database_backups
  }

  /**
   * Dernier backup terminé et son URL de téléchargement, **sans rien écrire sur disque**.
   *
   * `backup-db` s'en sert pour streamer l'archive directement vers S3 : un conteneur one-off n'a
   * pas à matérialiser plusieurs centaines de Mo pour les recopier aussitôt.
   */
  async getLatestBackupDownload(): Promise<ScalingoBackupDownload> {
    const backups = await this.listBackups()

    const latest = backups
      .filter((b) => b.status === 'done')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    if (!latest) {
      throw new Error('✗ Aucun backup terminé trouvé')
    }

    console.log(`✓ Dernier backup trouvé : ${latest.name || latest.id} - ${new Date(latest.created_at).toLocaleString('fr-FR')}`)

    console.log("→ Génération de l'URL de téléchargement...")
    const archiveRes = await fetch(
      `https://db-api.${this.region}.scalingo.com/api/databases/${this.addonId}/backups/${latest.id}/archive`,
      { headers: { Authorization: `Bearer ${this.addonToken}` } },
    )
    if (!archiveRes.ok) {
      throw new Error(`Archive URL fetch failed: ${archiveRes.status} ${await archiveRes.text()}`)
    }
    const { download_url } = await parseJson(archiveRes, ZBackupArchive, 'backups/archive')
    console.log('✓ URL de téléchargement obtenue')

    return { backup: latest, downloadUrl: download_url }
  }

  async downloadLatestBackup(destDir: string): Promise<string> {
    const { backup, downloadUrl } = await this.getLatestBackupDownload()

    console.log(`→ Téléchargement du backup (${(backup.size / 1024 / 1024).toFixed(1)} MB)...`)
    const downloadRes = await fetch(downloadUrl)
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
