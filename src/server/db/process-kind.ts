export type ProcessKind = 'cli' | 'worker' | 'web'

export const processKindFromArgv = (argv1: string | undefined): ProcessKind => {
  if (!argv1) return 'web'
  if (/worker[\\/]index\.ts$/.test(argv1)) return 'cli'
  if (/worker[\\/]worker\.ts$/.test(argv1)) return 'worker'
  return 'web'
}
