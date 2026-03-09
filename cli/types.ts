export interface ImportCommand {
  name: string
  description: string
  execute(options: ImportOptions): Promise<ImportResult>
}

export interface ImportOptions {
  dryRun?: boolean
  verbose?: boolean
  limit?: number
  file?: string
}

export interface ImportResult {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

export interface SyncCommand {
  name: string
  description: string
  execute(options: SyncOptions): Promise<SyncResult>
}

export interface SyncOptions {
  dryRun?: boolean
  verbose?: boolean
  force?: boolean
  date?: string
}

export interface SyncResult {
  updated: number
  skipped: number
  errors: string[]
}
