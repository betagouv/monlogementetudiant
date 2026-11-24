import { describe, expect, it, vi } from 'vitest'
import { EMetricItem } from '~/enums/metric-item'
import { adminCaller, ownerCaller } from './helpers/test-caller'
import './helpers/setup-integration'

const mockSession = vi.hoisted(() => ({
  current: null as null | { user: { role: 'admin' | 'owner' | 'user' } },
}))

vi.mock('~/services/better-auth', () => ({
  getServerSession: vi.fn(() => mockSession.current),
}))

import { NextRequest } from 'next/server'
import { GET } from '~/app/api/admin/metriques/export/route'
import { moderationCsvRow } from '~/server/admin-metrics/exports'

const range = { from: '2026-01', to: '2026-03' }

const exportRequest = (params: Record<string, string>) =>
  new NextRequest(`http://localhost/api/admin/metriques/export?${new URLSearchParams(params).toString()}`)

describe('admin.metrics router', () => {
  it('renvoie les séries de candidatures', async () => {
    const series = await adminCaller.admin.metrics.candidatures({ range })
    expect(series.map((s) => s.key)).toContain(EMetricItem.CONTACTS_TRANSMIS)
    expect(series[0]?.values).toHaveLength(3)
  })

  it('refuse un non-admin', async () => {
    await expect(ownerCaller.admin.metrics.candidatures({ range })).rejects.toMatchObject({
      code: expect.stringMatching(/FORBIDDEN|UNAUTHORIZED|NOT_FOUND/),
    })
  })

  it('rejette une plage inversée', async () => {
    await expect(adminCaller.admin.metrics.students({ range: { from: '2026-03', to: '2026-01' } })).rejects.toThrow()
  })
})

describe('GET /api/admin/metriques/export', () => {
  it('refuse sans session admin', async () => {
    mockSession.current = null
    const response = await GET(exportRequest({ item: EMetricItem.CONTACTS_TRANSMIS, ...range }))
    expect(response.status).toBe(401)
  })

  it('refuse un indicateur inconnu', async () => {
    mockSession.current = { user: { role: 'admin' } }
    const response = await GET(exportRequest({ item: 'inconnu', ...range }))
    expect(response.status).toBe(400)
    expect(await response.text()).toBe('Indicateur inconnu')
  })

  it('refuse from > to avec le message français', async () => {
    mockSession.current = { user: { role: 'admin' } }
    const response = await GET(exportRequest({ item: EMetricItem.CONTACTS_TRANSMIS, from: '2026-03', to: '2026-01' }))
    expect(response.status).toBe(400)
    expect(await response.text()).toBe('La date de début doit précéder la date de fin')
  })

  it('refuse un mois manquant pour la modération', async () => {
    mockSession.current = { user: { role: 'admin' } }
    const response = await GET(exportRequest({ item: 'moderation' }))
    expect(response.status).toBe(400)
    expect(await response.text()).toBe('Mois invalide')
  })

  it('refuse une période manquante avec le message français', async () => {
    mockSession.current = { user: { role: 'admin' } }
    const response = await GET(exportRequest({ item: EMetricItem.CONTACTS_TRANSMIS }))
    expect(response.status).toBe(400)
    expect(await response.text()).toBe('Mois invalide')
  })

  it('exporte une série mensuelle', async () => {
    mockSession.current = { user: { role: 'admin' } }
    const response = await GET(exportRequest({ item: EMetricItem.CONTACTS_TRANSMIS, ...range }))
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toContain('metriques-contacts_transmis-2026-01-2026-03.csv')
    const [header, ...rows] = (await response.text()).replace(/^﻿/, '').split('\n')
    expect(header).toBe('mois;valeur;boursiers;part_boursiers;source')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatch(/^2026-01;/)
  })

  it.each([
    [
      'moderation',
      'gestionnaire;segment;recus;boursiers;a_traiter;traites;jamais_traites;part_jamais_traites;contactes;part_contactes;delai_moyen_heures;alertes;suspensions',
    ],
    ['tension-marche', 'ville;disponibles;total_renseigne;total_publie;tension;couverture'],
    ['zones-detendues', 'ville;recherches;residences_ouvertes;sans_contact;part_sans_contact'],
  ])('exporte %s par mois', async (item, expected) => {
    mockSession.current = { user: { role: 'admin' } }
    const response = await GET(exportRequest({ item, month: '2026-02' }))
    expect(response.status).toBe(200)
    expect((await response.text()).replace(/^﻿/, '').split('\n')[0]).toBe(expected)
  })

  it('exporte les gestionnaires à cibler et le parcours contact', async () => {
    mockSession.current = { user: { role: 'admin' } }
    const targets = await GET(exportRequest({ item: 'gestionnaires-a-cibler' }))
    expect((await targets.text()).replace(/^﻿/, '').split('\n')[0]).toBe('gestionnaire;residences_avec_dispo;logements_disponibles')
    const path = await GET(exportRequest({ item: 'parcours-contact', ...range }))
    expect((await path.text()).replace(/^﻿/, '').split('\n')[0]).toBe(
      'mois;logements_publies_hors_crous;logements_parcours_active;part;residences_sans_total;gestionnaires_actives;gestionnaires_avec_dispo',
    )
  })
})

describe('moderationCsvRow', () => {
  it('calcule les parts sur les contacts reçus', () => {
    const row = moderationCsvRow({
      ownerId: 1,
      ownerName: 'Bailleur',
      month: '2026-02',
      recus: 10,
      recusBoursiers: 4,
      aTraiter: 5,
      traites: 2,
      jamaisTraites: 3,
      contactes: 1,
      delaiMoyenHeures: null,
      alertes: 0,
      suspensions: 0,
      segment: 'irregulier',
    })
    expect(row.part_jamais_traites).toBe(30)
    expect(row.part_contactes).toBe(10)
    expect(row.delai_moyen_heures).toBe('')
  })
})
