import { Readable } from 'node:stream'
import { eq } from 'drizzle-orm'
import { closeDb, db } from '~/server/db'
import { importJobs } from '~/server/db/schema/import-jobs'
import { env } from '~/server/env'
import {
  backupKey,
  backupSize,
  DAILY_PREFIX,
  deleteBackups,
  expiredDailyKeys,
  isKeeperDay,
  listBackupKeys,
  uploadBackup,
} from '../lib/backup-storage'
import { ScalingoBackupService } from '../lib/scalingo-backup'
import { captureCliException } from '../sentry'

interface BackupDbOptions {
  dryRun?: boolean
  verbose?: boolean
}

/**
 * Âge maximum toléré pour le backup Scalingo repris. Au-delà, on refuse plutôt que de déposer le
 * backup de l'avant-veille sous la date du jour : un cron en échec envoie un mail, un doublon
 * silencieux passerait inaperçu jusqu'au jour où on en aurait besoin.
 */
const MAX_BACKUP_AGE_HOURS = 36

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

/**
 * Copie le dernier backup PostgreSQL produit par Scalingo vers le bucket S3 de sauvegarde.
 *
 * On ne produit pas le dump nous-mêmes : `pg_dump` n'existe pas dans un conteneur Node Scalingo,
 * et l'addon PostgreSQL fabrique déjà un backup cohérent chaque nuit. On se contente de
 * l'externaliser.
 *
 * Rétention (voir `cli/lib/backup-storage.ts`) : le 1er et le 15 du mois partent sous `monthly/`
 * et sont conservés indéfiniment, les autres jours sous `daily/` avec une fenêtre glissante de
 * 31 jours purgée à la fin de ce même run.
 */
export async function backupDb(options: BackupDbOptions = {}): Promise<void> {
  const { dryRun = false, verbose = false } = options

  // `cron.json` est commun à toutes les apps déployées depuis ce repo : la garde est ici, pas
  // dans le planificateur. On ne sauvegarde pas la base de staging.
  if (env.NEXT_PUBLIC_APP_ENV !== 'production' && !dryRun) {
    console.info(`[${env.NEXT_PUBLIC_APP_ENV}] backup-db ignoré hors production (utilisez --dry-run pour simuler)`)
    return
  }

  const now = new Date()
  console.log(`💾 Backup de la base vers S3${dryRun ? ' [dry-run]' : ''}...`)

  // Le bucket n'est requis qu'en production : en dry-run local il est normal qu'il manque, on se
  // contente alors de montrer le backup retenu et la clé calculée, sans toucher à S3.
  const hasBucket = Boolean(env.S3_BACKUP_BUCKET)
  if (!hasBucket) {
    if (!dryRun) throw new Error('S3_BACKUP_BUCKET manquant : impossible de déposer le backup.')
    console.warn('  ⚠️  S3_BACKUP_BUCKET non renseigné : les étapes S3 sont ignorées.')
  }

  let jobId: number | null = null
  if (!dryRun) {
    const [job] = await db
      .insert(importJobs)
      .values({ type: 'backup-db', status: 'running', source: 'backup-db', createdBy: 'cron', startedAt: now })
      .returning({ id: importJobs.id })
    jobId = job.id
  }

  try {
    console.log('→ Authentification Scalingo...')
    const scalingo = new ScalingoBackupService()
    await scalingo.authenticate()

    const { backup, downloadUrl } = await scalingo.getLatestBackupDownload()

    const ageHours = (now.getTime() - new Date(backup.created_at).getTime()) / (60 * 60 * 1000)
    if (ageHours > MAX_BACKUP_AGE_HOURS) {
      throw new Error(
        `Le dernier backup Scalingo date de ${ageHours.toFixed(1)} h (max ${MAX_BACKUP_AGE_HOURS} h) : ` +
          "backup non déposé pour ne pas faire passer une vieille archive pour celle du jour. Vérifier l'addon PostgreSQL.",
      )
    }

    const key = backupKey(scalingo.app, now)
    console.log(
      `→ Destination : ${key} (${formatBytes(backup.size)})${isKeeperDay(now) ? ' — conservé indéfiniment' : ` — purgé dans 31 jours`}`,
    )

    if (dryRun || !hasBucket) {
      console.log('  [dry-run] archive non téléchargée, rien déposé dans S3.')
    } else {
      console.log("→ Transfert de l'archive vers S3...")
      const download = await fetch(downloadUrl)
      if (!download.ok || !download.body) {
        throw new Error(`Téléchargement du backup Scalingo échoué : ${download.status}`)
      }

      await uploadBackup({
        key,
        body: Readable.fromWeb(download.body as never),
        metadata: {
          'scalingo-app': scalingo.app,
          'scalingo-backup-id': backup.id,
          'scalingo-created-at': backup.created_at,
          'uploaded-at': now.toISOString(),
          'source-size': String(backup.size),
        },
      })

      // On confirme la taille avant de purger quoi que ce soit : une archive vide ou tronquée ne
      // doit pas prendre la place de la dernière valide.
      const uploaded = await backupSize(key)
      if (uploaded === null) throw new Error(`Objet ${key} introuvable après upload.`)
      if (uploaded !== backup.size) {
        throw new Error(`Taille déposée incohérente pour ${key} : ${uploaded} octets reçus, ${backup.size} attendus.`)
      }

      console.log(`✓ Backup déposé : ${key} (${formatBytes(uploaded)})`)
    }

    // Purge seulement maintenant : tant que le backup du jour n'est pas confirmé en place, on ne
    // supprime aucun ancien.
    const dailyKeys = hasBucket ? await listBackupKeys(DAILY_PREFIX) : []
    const expired = expiredDailyKeys(dailyKeys, now)

    if (verbose) {
      const ignored = dailyKeys.filter((k) => !expired.includes(k))
      console.log(`  ${dailyKeys.length} quotidien(s) en place, ${ignored.length} conservé(s), ${expired.length} expiré(s)`)
    }

    if (expired.length === 0) {
      console.log('→ Aucun backup quotidien à purger.')
    } else if (dryRun) {
      console.log(`  [dry-run] ${expired.length} backup(s) quotidien(s) seraient supprimés :`)
      for (const k of expired) console.log(`    - ${k}`)
    } else {
      await deleteBackups(expired)
      console.log(`✓ ${expired.length} backup(s) quotidien(s) de plus de 31 jours supprimés.`)
      if (verbose) for (const k of expired) console.log(`    - ${k}`)
    }

    if (jobId !== null) {
      await db
        .update(importJobs)
        .set({
          status: 'done',
          endedAt: new Date(),
          updatedAt: new Date(),
          summary: {
            deleted: expired.length,
            context: { key, bytes: backup.size, scalingoBackupId: backup.id, keeper: isKeeperDay(now) },
          },
        })
        .where(eq(importJobs.id, jobId))
    }

    console.log('\n✓ Backup terminé.')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`\n❌ Backup échoué : ${message}`)

    if (jobId !== null) {
      await db
        .update(importJobs)
        .set({ status: 'error', endedAt: new Date(), updatedAt: new Date(), summary: { errors: [message] } })
        .where(eq(importJobs.id, jobId))
    }

    await captureCliException(error)
    throw error
  } finally {
    await closeDb()
  }
}
