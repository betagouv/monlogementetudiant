import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getSheetRows, readWorkbook } from '../crous-helpers'

const FIXTURE = join(__dirname, 'fixtures', 'crous-residences.xlsx')
const sheetjsOutput = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'crous-residences.sheetjs-expected.json'), 'utf8'))

describe('lecture du classeur CROUS', () => {
  it('lit les onglets dans le même ordre que SheetJS', async () => {
    const workbook = await readWorkbook(FIXTURE)

    expect(workbook.map((sheet) => sheet.sheet)).toEqual(sheetjsOutput.sheetNames)
  })

  it('produit les mêmes lignes que SheetJS sheet_to_json', async () => {
    const workbook = await readWorkbook(FIXTURE)

    expect(getSheetRows(workbook, 'Liste residences', 0)).toEqual(sheetjsOutput.residences)
    expect(getSheetRows(workbook, 'Liste types de lgt', 1)).toEqual(sheetjsOutput.typologies)
  })

  it("retombe sur l'index quand le nom d'onglet est absent", async () => {
    const workbook = await readWorkbook(FIXTURE)

    expect(getSheetRows(workbook, 'Onglet renommé', 2)).toEqual(sheetjsOutput.typologies)
  })

  it('signale un onglet introuvable', async () => {
    const workbook = await readWorkbook(FIXTURE)

    expect(() => getSheetRows(workbook, 'Onglet renommé', 9)).toThrow('Onglet XLSX introuvable')
  })
})
