import { NextResponse } from 'next/server'
import { getServerSession } from '~/auth'
import { ZUpdateAlertRequest } from '~/schemas/alerts/update-alert'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const auth = await getServerSession()
  if (!auth || !auth.session || !auth.session.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const response = await fetch(`${process.env.API_URL}/alerts/${id}/`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${auth.session.accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to delete alert' }, { status: response.status })
    }
    return NextResponse.json({ message: 'Alert deleted successfully' }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getServerSession()
  if (!auth || !auth.session || !auth.session.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()

    const validatedData = ZUpdateAlertRequest.parse(body)

    const response = await fetch(`${process.env.API_URL}/alerts/${id}/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.session.accessToken}`,
      },
      body: JSON.stringify(validatedData),
    })

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to update alert with id: ${id}` }, { status: response.status })
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
