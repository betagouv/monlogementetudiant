import * as Sentry from '@sentry/nextjs'
import { and, eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { ResidenceImagesError, storeResidenceImages } from '~/server/bailleur/residence-images'
import { authorizeResidenceImagesRequest, imageFilesFrom } from '~/server/bailleur/residence-images-request'
import { db } from '~/server/db'
import { accommodations } from '~/server/db/schema/accommodations'

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const authorization = await authorizeResidenceImagesRequest(request)
  if ('response' in authorization) return authorization.response
  const { role, owner } = authorization.user
  const { slug } = await params

  // Même pour un admin, refuser un slug inexistant afin de ne pas créer d'objets orphelins.
  const accommodationWhere =
    role === 'admin' ? eq(accommodations.slug, slug) : and(eq(accommodations.slug, slug), eq(accommodations.ownerId, owner!.id))
  const [accommodation] = await db.select({ id: accommodations.id }).from(accommodations).where(accommodationWhere).limit(1)
  if (!accommodation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const formData = await request.formData()
    const files = imageFilesFrom(formData)
    if (!files) return NextResponse.json({ error: 'Aucune image valide fournie' }, { status: 400 })

    const imagesUrls = await storeResidenceImages(files, async (urls) => {
      const [row] = await db
        .update(accommodations)
        .set({
          imagesUrls: sql`coalesce(${accommodations.imagesUrls}, '{}'::text[]) || ARRAY[${sql.join(
            urls.map((url) => sql`${url}`),
            sql`, `,
          )}]::text[]`,
          updatedAt: new Date(),
        })
        .where(eq(accommodations.id, accommodation.id))
        .returning({ imagesUrls: accommodations.imagesUrls })
      if (!row) throw new Error('Résidence introuvable')
      return row.imagesUrls ?? []
    })

    return NextResponse.json({ imagesUrls })
  } catch (error) {
    if (error instanceof ResidenceImagesError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    Sentry.captureException(error, { tags: { route: 'upload' } })
    return NextResponse.json({ error: "L'upload a échoué" }, { status: 500 })
  }
}
