/** Cookies de la requête simulée, partagés par les mocks de `next/headers`. */
const jar = new Map<string, string>()

export const testCookies = {
  get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
  set: (name: string, value: string) => {
    jar.set(name, value)
  },
  delete: (name: string) => {
    jar.delete(name)
  },
  clear: () => jar.clear(),
}
