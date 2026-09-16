import { createTranslator } from 'next-intl'
import { describe, expect, it } from 'vitest'
import { createZTypologies, TYPOLOGIES } from '~/schemas/accommodations/typology'
import { createZCreateAlertRequest } from '~/schemas/alerts/create-alert'
import type { TSchemaMessageKey, TSchemaTranslator } from '~/schemas/schema-translator'
import enSchemas from '../../messages/schemas/en.json'
import frSchemas from '../../messages/schemas/fr.json'

const leafKeys = (messages: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : leafKeys(value as Record<string, unknown>, `${prefix}${key}.`),
  )

const createSchemaTranslator = (locale: 'fr' | 'en', onError?: (error: Error) => void): TSchemaTranslator =>
  createTranslator({ locale, messages: { schemas: locale === 'fr' ? frSchemas : enSchemas }, namespace: 'schemas', onError })

describe('messages/schemas', () => {
  it('fr.json et en.json ont exactement les mêmes clés', () => {
    expect(leafKeys(enSchemas).sort()).toEqual(leafKeys(frSchemas).sort())
  })

  it.each(['fr', 'en'] as const)('chaque message %s est un ICU valide', (locale) => {
    const errors: Error[] = []
    const t = createSchemaTranslator(locale, (error) => errors.push(error))
    for (const key of leafKeys(frSchemas)) t(key as TSchemaMessageKey, { total: 3, typology: 'T1', max: 2000 })
    expect(errors).toEqual([])
  })

  it('les libellés FR des typologies restent alignés sur TYPOLOGIES', () => {
    expect(frSchemas.typologies).toEqual(Object.fromEntries(TYPOLOGIES.map(({ type, label }) => [type, label])))
  })
})

describe('fabriques de schémas traduites', () => {
  const tEn = createSchemaTranslator('en')

  it('produit les messages anglais avec un traducteur EN', () => {
    const result = createZCreateAlertRequest(tEn).safeParse({ name: '', cityId: 1, hasColiving: false, isAccessible: false, maxPrice: 500 })
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.message)).toEqual(['The alert name is required'])
  })

  it('interpole le libellé traduit de la typologie', () => {
    const typology = { type: 't1' as const, colocation: false }
    const result = createZTypologies(tEn).safeParse([typology, typology])
    expect(result.error?.issues[0].message).toBe('The type "T1 studio" is already used')
  })
})
