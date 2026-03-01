import { NextResponse } from 'next/server'
import { getServerSession } from '~/auth'
import { ZUpdateResidence } from '~/schemas/accommodations/update-residence'
import { ZUpdateResidenceList } from '~/schemas/accommodations/update-residence-list'

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const auth = await getServerSession()
  if (!auth || !auth.session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const updateType = url.searchParams.get('type')
    const body = await request.json()

    let validatedData
    if (updateType === 'details') {
      validatedData = ZUpdateResidence.parse(body)
    } else {
      validatedData = ZUpdateResidenceList.parse(body)
    }

    const response = await fetch(`${process.env.API_URL}/accommodations/my/${slug}/`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.session.accessToken}`,
        cache: 'no-store',
      },
      body: JSON.stringify(validatedData),
    })

    if (!response.ok) {
      console.log('response', validatedData, await response.json())
      return NextResponse.json({ error: `Failed to update accommodation with slug: ${slug}` }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Unknown error occurred' }, { status: 500 })
  }
}
