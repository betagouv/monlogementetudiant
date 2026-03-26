import { program } from 'commander'
import { healthcheck, healthcheckCities } from './commands/healthcheck'
import { importBackup } from './commands/import-backup'
import { migrate } from './commands/migrate'
import { migrateUsers } from './commands/migrate-users'
import { uploadImages } from './commands/upload-images'
import { runImport, runSync } from './factory'

program.name('mle').description('MLE CLI tools')

program.command('migrate-users').description('Migrate Django users to better-auth').action(migrateUsers)

program.command('migrate').description('Apply Drizzle migrations').action(migrate)

program
  .command('import-backup')
  .description('Import Scalingo backup into local DB')
  .option('--backup-path <path>', 'Use a local backup file instead of downloading')
  .option('--skip-download', 'Skip download, use existing backup in /tmp/jde-backup/')
  .action(importBackup)

// Import commands (arpej-ibail)
program
  .command('import <type>')
  .description('Import de données (arpej-ibail, crous, csv, fac-habitat)')
  .option('--dry-run', 'Simuler sans modifier la BDD')
  .option('--verbose', 'Afficher les détails')
  .option('--limit <n>', "Limiter le nombre d'éléments", parseInt)
  .option('--file <path>', 'Chemin vers un fichier JSON local')
  .option('--source <name>', 'Identifiant de la source externe')
  .action((type, opts) => runImport(type, opts))

// Sync commands (cities, rents, students, stats)
program
  .command('sync <type>')
  .description('Synchronisation (cities, rents, students, stats)')
  .option('--dry-run', 'Simuler sans modifier la BDD')
  .option('--verbose', 'Afficher les détails')
  .option('--force', 'Forcer la mise à jour')
  .option('--date <date>', 'Date de référence (YYYY-MM-DD)')
  .action((type, opts) => runSync(type, opts))

program
  .command('upload-images <dir>')
  .description('Upload des images depuis un dossier local vers S3 (un sous-dossier = un groupe)')
  .requiredOption('--name <name>', 'Nom du gestionnaire (ex: aclef, acm-habitat)')
  .action((dir, opts) => uploadImages(dir, opts))

program
  .command('healthcheck')
  .description('Vérifie la cohérence des résidences publiées (city_id, URLs)')
  .option('--verbose', 'Afficher le détail de chaque résidence')
  .option('--fetch', 'Tester les URLs en HTTP (nécessite le serveur Next.js)')
  .option('--base-url <url>', 'URL de base pour les tests HTTP', 'http://localhost:3000')
  .action((opts) => healthcheck(opts))

program
  .command('healthcheck-cities')
  .description('Vérifie les pages villes en HTTP (GET /trouver-un-logement-etudiant/ville/{slug})')
  .option('--verbose', 'Afficher le détail de chaque ville')
  .option('--base-url <url>', 'URL de base pour les tests HTTP', 'http://localhost:3000')
  .action((opts) => healthcheckCities(opts))

program.parse()
