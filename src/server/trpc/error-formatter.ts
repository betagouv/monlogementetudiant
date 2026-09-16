import { TRPCError } from '@trpc/server'

export const UNEXPECTED_ERROR_MESSAGE = 'Une erreur inattendue est survenue'

/**
 * Une erreur « inattendue » est une exception non-tRPC (Postgres, Drizzle, fetch…) que tRPC a enveloppée
 * en INTERNAL_SERVER_ERROR en reprenant son message. Ce message peut contenir la requête SQL et ses
 * paramètres (`Failed query: … params: …`) : il ne doit jamais atteindre le client en production.
 * Les TRPCError levées volontairement gardent leur message, écrit pour l'utilisateur.
 */
export const isUnexpectedError = (error: TRPCError): boolean =>
  error.code === 'INTERNAL_SERVER_ERROR' &&
  error.cause instanceof Error &&
  !(error.cause instanceof TRPCError) &&
  error.message === error.cause.message

export const maskUnexpectedErrorMessage = <TShape extends { message: string }>(
  shape: TShape,
  error: TRPCError,
  isProduction: boolean,
): TShape => (isProduction && isUnexpectedError(error) ? { ...shape, message: UNEXPECTED_ERROR_MESSAGE } : shape)
