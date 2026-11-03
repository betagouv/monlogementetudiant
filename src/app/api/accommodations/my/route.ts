import * as Sentry from '@sentry/nextjs'
import { TRPCError } from '@trpc/server'
import { NextResponse } from 'next/server'
import { createResidence, ZCreateResidenceInput } from '~/server/bailleur/create-residence'
import { ResidenceImagesError } from '~/server/bailleur/residence-images'
import { authorizeResidenceImagesRequest, imageFilesFrom } from '~/server/bailleur/residence-images-request'

export async function POST(request: Request) {
  const authorization = await authorizeResidenceImagesRequest(request)
  if ('response' in authorization) return authorization.response

  try {
    const formData = await request.formData()
    const files = imageFilesFrom(formData)
    if (!files) return NextResponse.json({ error: 'Aucune image valide fournie' }, { status: 400 })

    const payload = formData.get('payload')
    let json: unknown
    try {
      json = typeof payload === 'string' ? JSON.parse(payload) : undefined
    } catch {
      json = undefined
    }
    const parsed = ZCreateResidenceInput.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Formulaire invalide', issues: parsed.error.issues }, { status: 400 })
    }

    return NextResponse.json(await createResidence(authorization.user, parsed.data, files))
  } catch (error) {
    if (error instanceof ResidenceImagesError) return NextResponse.json({ error: error.message }, { status: 400 })
    if (error instanceof TRPCError && error.code === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    Sentry.captureException(error, { tags: { route: 'create-residence' } })
    return NextResponse.json({ error: 'La création de la résidence a échoué' }, { status: 500 })
  }
}
