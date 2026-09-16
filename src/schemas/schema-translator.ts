import { createTranslator } from 'next-intl'
import frSchemas from '../../messages/schemas/fr.json'

/** Chemins pointés (`errors.emailRequired`, `typologies.t1`, …) des feuilles d'un objet de messages. */
type TMessageLeafPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${TMessageLeafPaths<T[K]>}`
}[keyof T & string]

export type TSchemaMessageKey = TMessageLeafPaths<typeof frSchemas>

/**
 * Traducteur des messages de validation Zod (namespace `schemas`, fichiers `messages/schemas/<locale>.json`).
 * Côté client : `useTranslations('schemas')` ; côté serveur, CLI et tests : `frSchemaTranslator`.
 */
export type TSchemaTranslator = (key: TSchemaMessageKey, values?: Record<string, string | number>) => string

/**
 * Traducteur français par défaut des fabriques de schémas : les usages serveur (tRPC, import CSV, CLI)
 * exposent `issue.message` et doivent rester en français. N'embarque que `messages/schemas/fr.json`.
 */
export const frSchemaTranslator: TSchemaTranslator = createTranslator({
  locale: 'fr',
  messages: { schemas: frSchemas },
  namespace: 'schemas',
})
