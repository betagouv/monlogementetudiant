import { program } from 'commander'
import { migrateUsers } from './commands/migrate-users'
import { importBackup } from './commands/import-backup'

program
  .name('jde')
  .description('JDE CLI tools')

program
  .command('migrate-users')
  .description('Migrate Django users to better-auth')
  .requiredOption('--file <path>', 'Path to Django users JSON dump')
  .action(migrateUsers)

program
  .command('import-backup')
  .description('Import Scalingo backup into local DB')
  .option('--backup-path <path>', 'Use a local backup file instead of downloading')
  .option('--skip-download', 'Skip download, use existing backup in /tmp/jde-backup/')
  .action(importBackup)

program.parse()
