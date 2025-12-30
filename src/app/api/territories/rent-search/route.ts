import fs from 'fs'
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
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

    const searchTerm = validatedQuery.q.toLowerCase()

    const filteredCities = Object.entries(rentData)
      .filter(([city]) => city.toLowerCase().includes(searchTerm))
      .map(([city, rentPerM2]) => ({
        city,
        rentPerM2,
        rentFor20M2: rentPerM2 * 20,
      }))
      .sort((a, b) => {
        const cityA = a.city.toLowerCase()
        const cityB = b.city.toLowerCase()

        // 1. Match exact
        if (cityA === searchTerm && cityB !== searchTerm) return -1
        if (cityB === searchTerm && cityA !== searchTerm) return 1
        if (cityA === searchTerm && cityB === searchTerm) return 0

        // 2. Arrondissements (e.g., "Paris 1er", "Paris 2e", etc.)
        const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const arrondissementRegex = new RegExp(`^${escapedSearchTerm}\\s+(\\d+)(?:er|e|ème)`, 'i')
        const arrondA = cityA.match(arrondissementRegex)
        const arrondB = cityB.match(arrondissementRegex)

        if (arrondA && arrondB) {
          return parseInt(arrondA[1]) - parseInt(arrondB[1])
        }
        if (arrondA && !arrondB) return -1
        if (!arrondA && arrondB) return 1

        // 3. Cities that begin with search term
        const startsA = cityA.startsWith(searchTerm)
        const startsB = cityB.startsWith(searchTerm)

        if (startsA && !startsB) return -1
        if (!startsA && startsB) return 1

        // 4. Within same category, sort alphabetically
        return cityA.localeCompare(cityB)
      })

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
