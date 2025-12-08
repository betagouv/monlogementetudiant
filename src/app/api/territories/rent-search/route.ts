import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const searchSchema = z.object({
  q: z.string().min(1, 'Query is required'),
})

type RentData = Record<string, number>

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    const validatedQuery = searchSchema.parse({ q: query })

    const filePath = path.join(process.cwd(), 'public', 'loyers.json')
    const fileContents = fs.readFileSync(filePath, 'utf8')
    const rentData: RentData = JSON.parse(fileContents)

    const filteredCities = Object.entries(rentData)
      .filter(([city]) => city.toLowerCase().includes(validatedQuery.q.toLowerCase()))
      .slice(0, 20)
      .map(([city, rentPerM2]) => ({
        city,
        rentPerM2,
        rentFor20M2: rentPerM2 * 20,
      }))

    return NextResponse.json({
      cities: filteredCities,
      total: filteredCities.length,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameter' }, { status: 400 })
    }

    console.error('Error searching rent data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
