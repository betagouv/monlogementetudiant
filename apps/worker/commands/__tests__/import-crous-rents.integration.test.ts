import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAccommodation, createExternalSource, createOwner } from '~/__tests__/fixtures/factories'
import { getTestDb } from '~/__tests__/helpers/test-db'
import { accommodations } from '~/server/db/schema'
import { typologiesByType, typologyDraft } from '~/server/lib/typologies'

const { importCrousRents } = await import('../import-crous-rents')

// Le fichier reprend le format CROUS a deux onglets : Alpha (UAI001A) recoit APT1 300,4-350,6 +
// CHAMBRE 250 (fusionnes en t1 250-351) et APT1BIS 400-450 ; Beta (UAI002B) recoit APT1 310-320 ;
// la troisieme residence (UAI999Z) n'existe pas en BDD.
const FIXTURE = path.join(__dirname, 'fixtures', 'crous-rents.xlsx')

const db = getTestDb()
const noop = () => undefined
const tmpDirs: string[] = []

function tmpReportPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crous-rents-'))
  tmpDirs.push(dir)
  return path.join(dir, 'rapport.csv')
}

async function loadTypologies(accommodationId: number) {
  const row = await db.query.accommodations.findFirst({
    where: eq(accommodations.id, accommodationId),
    with: { typologies: true },
  })
  return typologiesByType(row?.typologies ?? [])
}

let alphaId: number
let betaId: number

beforeEach(async () => {
  vi.spyOn(console, 'log').mockImplementation(noop)

  const owner = await createOwner({ name: 'CROUS Test', slug: 'crous-test' })
  const alpha = await createAccommodation({ name: 'Residence Alpha', ownerId: owner.id }, [
    typologyDraft('t1', { priceMin: 100, priceMax: 200, nbTotal: 10, superficieMin: 12.5 }),
    typologyDraft('t1_bis', { priceMin: 150, priceMax: 160 }),
    // Absentes du fichier : l'import ne doit pas les toucher (simple mise a jour de prix).
    typologyDraft('t2', { priceMin: 180, priceMax: 190 }),
    typologyDraft('t3', { priceMin: 170, priceMax: 175, nbTotal: 4 }),
  ])
  const beta = await createAccommodation({ name: 'Residence Beta', ownerId: owner.id }, [
    typologyDraft('t1', { priceMin: 500, priceMax: 600 }),
  ])
  alphaId = alpha.id
  betaId = beta.id
  await createExternalSource({ accommodationId: alphaId, source: 'crous', sourceId: 'UAI001A' })
  await createExternalSource({ accommodationId: betaId, source: 'crous', sourceId: 'UAI002B' })
})

afterEach(() => {
  vi.restoreAllMocks()
  for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe('import-crous-rents', () => {
  it('fusionne les loyers par typologie et preserve compteurs et surfaces', async () => {
    await importCrousRents(FIXTURE, { owner: 'crous-test' })

    const alpha = await loadTypologies(alphaId)
    // APT1 (300,4-350,6 arrondi) et CHAMBRE (250) fusionnent dans t1 ; nb_total et surface intacts.
    expect(alpha.t1).toMatchObject({ priceMin: 250, priceMax: 351, nbTotal: 10, superficieMin: 12.5 })
    expect(alpha.t1_bis).toMatchObject({ priceMin: 400, priceMax: 450 })
    // Typologies hors fichier : strictement intouchees.
    expect(alpha.t2).toMatchObject({ priceMin: 180, priceMax: 190 })
    expect(alpha.t3).toMatchObject({ priceMin: 170, priceMax: 175, nbTotal: 4 })

    const beta = await loadTypologies(betaId)
    expect(beta.t1).toMatchObject({ priceMin: 310, priceMax: 320 })
  })

  it('recalcule les agregats de prix de la residence', async () => {
    await importCrousRents(FIXTURE, { owner: 'crous-test' })

    const alpha = await db.query.accommodations.findFirst({ where: eq(accommodations.id, alphaId) })
    expect(alpha).toMatchObject({ priceMin: 170, priceMax: 450, nbTotalApartments: 14 })
  })

  it("n'ecrit rien en dry-run", async () => {
    await importCrousRents(FIXTURE, { owner: 'crous-test', dryRun: true })

    const alpha = await loadTypologies(alphaId)
    expect(alpha.t1).toMatchObject({ priceMin: 100, priceMax: 200 })
    expect(alpha.t2).toMatchObject({ priceMin: 180, priceMax: 190 })
  })

  it('ecrit un rapport avant/apres fidele au merge, y compris en dry-run', async () => {
    const report = tmpReportPath()
    await importCrousRents(FIXTURE, { owner: 'crous-test', dryRun: true, report })

    const lines = fs.readFileSync(report, 'utf8').split('\n')
    expect(lines[0]).toBe('sourceId,id,slug,type,price_min_avant,price_min_apres,price_max_avant,price_max_apres,action')
    const byKey = new Map(
      lines.slice(1).map((line) => {
        const cells = line.split(',').map((cell) => cell.slice(1, -1))
        return [`${cells[0]}:${cells[3]}`, cells]
      }),
    )

    expect(byKey.get('UAI001A:t1')?.slice(4)).toEqual(['100', '250', '200', '351', 'mise_a_jour'])
    expect(byKey.get('UAI001A:t1_bis')?.slice(4)).toEqual(['150', '400', '160', '450', 'mise_a_jour'])
    expect(byKey.get('UAI001A:t2')?.slice(4)).toEqual(['180', '180', '190', '190', 'inchangee'])
    expect(byKey.get('UAI001A:t3')?.slice(4)).toEqual(['170', '170', '175', '175', 'inchangee'])
    expect(byKey.get('UAI002B:t1')?.slice(4)).toEqual(['500', '310', '600', '320', 'mise_a_jour'])
    // La residence du fichier absente en BDD est ignoree : aucune ligne pour elle.
    expect([...byKey.keys()].filter((key) => key.startsWith('UAI999Z'))).toEqual([])
  })
})
