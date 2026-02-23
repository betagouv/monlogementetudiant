export const numberToString = (value: number) => value?.toLocaleString('fr-FR')

/**
 * Outputs stopwatch timing to console for a given promise without changing the return value
 */
export const debugPromiseTiming = <T>(promise: Promise<T>, { name = 'promise' }: { name: string }) => {
  const startTime = performance.now()
  return promise.then((result) => {
    const duration = performance.now() - startTime
    console.log(`Promise "${name}" took ${numberToString(Math.round(duration))} ms`)
    return result
  })
}
