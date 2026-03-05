import { program } from 'commander'
import { migrateUsers } from './commands/migrate-users'
import { importBackup } from './commands/import-backup'
import { runImport, runSync } from './factory'

program
  .name('mle')
  .description('MLE CLI tools')

// Existing commands
program
  .command('migrate-users')
  .description('Migrate Django users to better-auth')
  .action(migrateUsers)

program
  .command('import-backup')
  .description('Import Scalingo backup into local DB')
  .option('--backup-path <path>', 'Use a local backup file instead of downloading')
  .option('--skip-download', 'Skip download, use existing backup in /tmp/jde-backup/')
  .action(importBackup)

// Import commands (arpej-ibail)
program
  .command('import <type>')
  .description('Import de données (arpej-ibail)')
  .option('--dry-run', 'Simuler sans modifier la BDD')
  .option('--verbose', 'Afficher les détails')
  .option('--limit <n>', 'Limiter le nombre d\'éléments', parseInt)
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

program.parse()
