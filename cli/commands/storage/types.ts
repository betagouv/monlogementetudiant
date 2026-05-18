export type BrokenReason =
  | 'key-not-in-s3' // la clé n'existe pas dans S3
  | 'http-not-ok' // la clé existe mais l'URL HTTP retourne non-200

export type BrokenUrl = {
  url: string
  key: string
  reason: BrokenReason
  httpStatus?: number
  accommodationId: number
  accommodationName: string
  accommodationSlug: string
}

export type UnreferencedFile = {
  key: string
  size: number
  lastModified?: Date
}

export type AuditStats = {
  s3ObjectsScanned: number
  dbUrlsChecked: number
  brokenUrlsCount: number
  unreferencedFilesCount: number
  unreferencedFilesTotalBytes: number
}

export type AuditResult = {
  brokenUrls: BrokenUrl[]
  unreferencedFiles: UnreferencedFile[]
  stats: AuditStats
}
