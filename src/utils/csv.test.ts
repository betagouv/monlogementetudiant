import { describe, expect, it } from 'vitest'
import { type TCsvColumn, toCsv } from './csv'

type Row = { name: string; count: number; published: boolean; city: string | null }

const columns: TCsvColumn<Row>[] = [
  { key: 'name', header: 'Résidence' },
  { key: 'count', header: 'Vues' },
  { key: 'published', header: 'Publiée' },
  { key: 'city', header: 'Ville' },
]

/** Retire le BOM pour comparer le contenu lui-même. */
const body = (csv: string) => csv.replace(/^﻿/, '')

describe('toCsv', () => {
  it('écrit un en-tête et une ligne par entrée, séparés par des points-virgules', () => {
    const csv = body(toCsv(columns, [{ name: 'Résidence A', count: 12, published: true, city: 'Lyon' }]))

    expect(csv.split('\n')).toEqual(['Résidence;Vues;Publiée;Ville', 'Résidence A;12;oui;Lyon'])
  })

  it('préfixe le fichier d’un BOM pour qu’Excel lise les accents', () => {
    expect(toCsv(columns, [])).toMatch(/^﻿/)
  })

  it('rend les booléens en français et les valeurs absentes par une cellule vide', () => {
    const csv = body(toCsv(columns, [{ name: 'B', count: 0, published: false, city: null }]))

    expect(csv.split('\n')[1]).toBe('B;0;non;')
  })

  it('protège les valeurs contenant le séparateur, un guillemet ou un saut de ligne', () => {
    const csv = body(toCsv(columns, [{ name: 'Résidence "Le Parc"; annexe', count: 1, published: true, city: 'Lyon\n7e' }]))

    expect(csv.split('\n')[1]).toBe('"Résidence ""Le Parc""; annexe";1;oui;"Lyon')
  })

  it('produit le seul en-tête quand il n’y a aucune ligne', () => {
    expect(body(toCsv(columns, []))).toBe('Résidence;Vues;Publiée;Ville')
  })
})
