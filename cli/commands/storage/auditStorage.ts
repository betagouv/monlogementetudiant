import * as fs from 'node:fs'
import * as path from 'node:path'
import { closeDb } from '~/server/db'
import { findStorageIssues } from './findStorageIssues'
import { fixBrokenUrls, fixUnreferencedFiles } from './fixStorageIssues'
import type { AuditResult } from './types'

interface AuditStorageOptions {
  csv?: string
  verbose?: boolean
  write?: boolean
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`
}

function printSummary(result: AuditResult, options: AuditStorageOptions): void {
  const { stats, brokenUrls, unreferencedFiles } = result

  console.log("\n📊 Résultats de l'audit S3\n")
  console.log(`  Objets S3 scannés  : ${stats.s3ObjectsScanned}`)
  console.log(`  URLs en base       : ${stats.dbUrlsChecked}`)
  console.log(`  URLs cassées       : ${stats.brokenUrlsCount}`)
  console.log(`  Fichiers orphelins : ${stats.unreferencedFilesCount} (${formatBytes(stats.unreferencedFilesTotalBytes)})`)

  if (options.verbose && brokenUrls.length > 0) {
    console.log('\n🔴 URLs cassées :')
    for (const b of brokenUrls) {
      const status = b.httpStatus ? ` (HTTP ${b.httpStatus})` : ''
      console.log(`  #${b.accommodationId} ${b.accommodationName} (${b.accommodationSlug})`)
      console.log(`    ${b.reason}${status} → ${b.url}`)
    }
  }

  if (options.verbose && unreferencedFiles.length > 0) {
    console.log('\n🟡 Fichiers S3 non référencés :')
    for (const f of unreferencedFiles) {
      const date = f.lastModified ? f.lastModified.toISOString().slice(0, 10) : '?'
      console.log(`  ${f.key} (${formatBytes(f.size)}, ${date})`)
    }
  }
}

function writeCsv(result: AuditResult, dir: string): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const BOM = '﻿'

  const brokenPath = path.join(dir, `broken-urls-${timestamp}.csv`)
  const brokenLines = [
    'Accommodation ID;Accommodation Name;Slug;URL;S3 Key;Reason;HTTP Status',
    ...result.brokenUrls.map((b) =>
      [b.accommodationId, b.accommodationName, b.accommodationSlug, b.url, b.key, b.reason, b.httpStatus ?? ''].join(';'),
    ),
  ]
  fs.writeFileSync(brokenPath, BOM + brokenLines.join('\n'), 'utf-8')
  console.log(`\n📄 Rapport URLs cassées       : ${brokenPath}`)

  const unrefPath = path.join(dir, `unreferenced-files-${timestamp}.csv`)
  const unrefLines = [
    'Key;Size (bytes);Last Modified',
    ...result.unreferencedFiles.map((f) => [f.key, f.size, f.lastModified?.toISOString() ?? ''].join(';')),
  ]
  fs.writeFileSync(unrefPath, BOM + unrefLines.join('\n'), 'utf-8')
  console.log(`📄 Rapport fichiers orphelins : ${unrefPath}`)
}

export async function auditStorage(options: AuditStorageOptions): Promise<void> {
  try {
    console.log('🔍 Audit du stockage S3... (vérification HTTP activée — peut être long)')
    if (!options.write) console.log('   Mode dry-run — utilisez --write pour appliquer les corrections')

    const result = await findStorageIssues({ fetch: true })

    printSummary(result, options)

    if (options.csv) {
      fs.mkdirSync(options.csv, { recursive: true })
      writeCsv(result, options.csv)
    }

    if (options.write) {
      console.log('\n🔧 Application des corrections...')

      if (result.brokenUrls.length > 0) {
        const { accommodationsUpdated, urlsRemoved } = await fixBrokenUrls(result.brokenUrls)
        console.log(`  ✅ URLs cassées : ${urlsRemoved} URL(s) supprimée(s) dans ${accommodationsUpdated} résidence(s)`)
      } else {
        console.log('  ✅ Aucune URL cassée à corriger')
      }

      if (result.unreferencedFiles.length > 0) {
        const { deletedCount, errorCount, freedBytes } = await fixUnreferencedFiles(result.unreferencedFiles)
        console.log(`  ✅ Fichiers S3 : ${deletedCount} supprimé(s) (${formatBytes(freedBytes)} libérés)`)
        if (errorCount > 0) console.log(`  ⚠️  ${errorCount} erreur(s) lors de la suppression S3`)
      } else {
        console.log('  ✅ Aucun fichier orphelin à supprimer')
      }
    }
  } finally {
    await closeDb()
  }
}
