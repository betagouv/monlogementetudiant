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
  source?: string
}

export interface ImportResultResidence {
  name: string
  slug: string
  city: string | null
  action: 'created' | 'updated'
}

export interface ImportResult {
  created: number
  updated: number
  skipped: number
  errors: string[]
  residences?: ImportResultResidence[]
  ownerName?: string
  ownerId?: number
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
  from?: string
  to?: string
  only?: 'stats' | 'events'
}

export interface SyncResult {
  updated: number
  skipped: number
  errors: string[]
  context?: Record<string, unknown>
}
