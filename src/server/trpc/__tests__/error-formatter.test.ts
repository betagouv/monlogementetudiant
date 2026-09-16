import { getTRPCErrorFromUnknown, TRPCError } from '@trpc/server'
import { describe, expect, it } from 'vitest'
import { maskUnexpectedErrorMessage, UNEXPECTED_ERROR_MESSAGE } from '../error-formatter'

const shapeOf = (error: TRPCError) => ({ message: error.message, code: -32603, data: { code: error.code } })

describe('maskUnexpectedErrorMessage', () => {
  const dbError = getTRPCErrorFromUnknown(new Error('Failed query: select * from "user" where id = $1\nparams: 42'))

  it('masque le message d’une erreur base de données en production', () => {
    expect(maskUnexpectedErrorMessage(shapeOf(dbError), dbError, true).message).toBe(UNEXPECTED_ERROR_MESSAGE)
  })

  it('garde le message brut hors production pour le débogage', () => {
    expect(maskUnexpectedErrorMessage(shapeOf(dbError), dbError, false).message).toContain('Failed query')
  })

  it('garde le message d’une TRPCError levée volontairement', () => {
    const explicit = new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: "L'e-mail de confirmation n'a pas pu être envoyé" })
    expect(maskUnexpectedErrorMessage(shapeOf(explicit), explicit, true).message).toBe(explicit.message)
  })

  it('garde le message métier même quand une cause technique est attachée', () => {
    const withCause = new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Envoi impossible', cause: new Error('ECONNRESET') })
    expect(maskUnexpectedErrorMessage(shapeOf(withCause), withCause, true).message).toBe('Envoi impossible')
  })

  it('ne touche pas aux autres codes', () => {
    const notFound = new TRPCError({ code: 'NOT_FOUND', message: 'Résidence introuvable' })
    expect(maskUnexpectedErrorMessage(shapeOf(notFound), notFound, true).message).toBe('Résidence introuvable')
  })
})
