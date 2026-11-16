import type { Readable } from 'node:stream'
import { DeleteObjectsCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { env } from '~/server/env'
import { s3 } from '~/server/services/s3'

/**
 * Rétention à deux vitesses, et **le tri se fait à l'écriture, pas à la suppression**.
 *
 * Les backups conservés indéfiniment sont déposés sous `monthly/`, les autres sous `daily/`.
 * La purge ne liste que `daily/` : les gardés sont physiquement hors de sa portée. Il n'y a donc
 * aucune condition à écrire pour les épargner — et donc aucune condition à se tromper.
 *
 * Pourquoi pas un lifecycle S3 : une règle de lifecycle raisonne en âge d'objet (en jours) et non
 * en calendrier, elle ne sait pas exclure « le 1er et le 15 ». Et un
 * `PutBucketLifecycleConfiguration` **remplace la configuration complète du bucket**, ce qui
 * écraserait silencieusement toute autre règle. Purger ici, c'est versionné, testable, et visible
 * en `--dry-run`.
 */
export const DAILY_PREFIX = 'daily/'
export const MONTHLY_PREFIX = 'monthly/'

/** Fenêtre glissante des backups quotidiens. Les gardés n'y sont pas soumis. */
const DAILY_RETENTION_DAYS = 31

/**
 * Jours du mois dont le backup est conservé indéfiniment. Le 1er et le 15 plutôt que le 1er et le
 * dernier jour : ces deux-là ne sont séparés que de 24 h (le 31/07 et le 01/08 contiennent
 * quasiment la même donnée), là où 1/15 donne deux points de restauration réellement distincts.
 * Et le 15 tombe tous les mois, contrairement à un « dernier jour » à 28/29/30/31.
 */
const KEEPER_DAYS = [1, 15]

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** `{app_name}-2026-08-18.tar.gz` — la date est en UTC, comme l'horloge des crons Scalingo. */
const KEY_PATTERN = /^(?:daily|monthly)\/.+-(\d{4})-(\d{2})-(\d{2})\.tar\.gz$/

const bucket = () => {
  const value = env.S3_BACKUP_BUCKET
  if (!value) throw new Error('S3_BACKUP_BUCKET manquant : impossible de déposer le backup.')
  return value
}

/** Ce backup-là doit-il être conservé indéfiniment ? */
export function isKeeperDay(date: Date): boolean {
  return KEEPER_DAYS.includes(date.getUTCDate())
}

/** `monthly/{app_name}-2026-08-01.tar.gz` ou `daily/{app_name}-2026-08-18.tar.gz` */
export function backupKey(appName: string, date: Date): string {
  const prefix = isKeeperDay(date) ? MONTHLY_PREFIX : DAILY_PREFIX
  return `${prefix}${appName}-${date.toISOString().slice(0, 10)}.tar.gz`
}

/**
 * Date encodée dans la clé, ou `null` si la clé n'est pas au format attendu.
 *
 * On lit la date de la clé et non le `LastModified` de l'objet : on maîtrise le format de clé,
 * c'est une fonction pure testable sans S3 et sans dépendre de l'horloge du fournisseur.
 */
export function dateFromKey(key: string): Date | null {
  const match = KEY_PATTERN.exec(key)
  if (!match) return null

  const [, year, month, day] = match
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))

  // Rejette les dates impossibles (`2026-02-31`), que `Date.UTC` reporterait silencieusement.
  if (date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return null

  return date
}

/**
 * Parmi les clés fournies, celles qui ont dépassé la fenêtre de rétention.
 *
 * Une clé hors format est **ignorée**, jamais supprimée : on ne détruit que ce qu'on comprend.
 * Une clé `monthly/` l'est aussi, par sécurité — en pratique la purge ne liste jamais ce préfixe.
 */
export function expiredDailyKeys(keys: string[], now: Date): string[] {
  const cutoff = now.getTime() - DAILY_RETENTION_DAYS * MS_PER_DAY

  return keys.filter((key) => {
    if (!key.startsWith(DAILY_PREFIX)) return false
    const date = dateFromKey(key)
    if (!date) return false
    return date.getTime() < cutoff
  })
}

/**
 * Dépose l'archive en flux (multipart). `lib-storage` réessaie **partie par partie** : un aléa
 * réseau ne fait pas repartir de zéro un transfert de plusieurs centaines de Mo, ce qui compte
 * pour un job qui tourne de nuit sans témoin.
 *
 * Pas d'ACL `public-read`, contrairement aux médias : l'objet n'est lisible qu'authentifié.
 */
export async function uploadBackup(input: { key: string; body: Readable; metadata: Record<string, string> }): Promise<void> {
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: bucket(),
      Key: input.key,
      Body: input.body,
      ContentType: 'application/gzip',
      Metadata: input.metadata,
    },
  })

  await upload.done()
}

/** Taille de l'objet déposé, ou `null` s'il est absent. Sert à vérifier le dépôt. */
export async function backupSize(key: string): Promise<number | null> {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket(), Key: key }))
    return head.ContentLength ?? null
  } catch {
    return null
  }
}

export async function listBackupKeys(prefix: string): Promise<string[]> {
  const keys: string[] = []
  let continuationToken: string | undefined

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket(),
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    )

    for (const obj of response.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key)
    }

    continuationToken = response.NextContinuationToken
  } while (continuationToken)

  return keys
}

/** `DeleteObjects` plafonne à 1000 clés par appel. */
const DELETE_BATCH_SIZE = 1000

export async function deleteBackups(keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += DELETE_BATCH_SIZE) {
    const batch = keys.slice(i, i + DELETE_BATCH_SIZE)
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket(),
        Delete: { Objects: batch.map((Key) => ({ Key })) },
      }),
    )
  }
}

export const __testing = { DAILY_RETENTION_DAYS, KEEPER_DAYS }
