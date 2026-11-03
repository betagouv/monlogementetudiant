import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body }
}

const UAI_DETAIL_SUP = {
  IDENTIFICATION: {
    NUMERO_UAI: '0341089Z',
    NATURES: [{ CODE: '520' }],
    SECTEURS: [{ CODE: 'PU' }],
    APPELLATIONS_OFFICIELLES: [{ VALEUR: 'Université de Montpellier' }],
    SIGLES: [{ VALEUR: 'UM' }],
  },
  LOCALISATION: {
    CODE_POSTAL: '34090',
    LOCALITE_ACHEMINEMENT: 'MONTPELLIER',
    TELEPHONE: '0411000000',
    MEL: 'contact@umontpellier.fr',
    ADRESSES: [{ VALEUR: '163 rue Auguste Broussonnet' }],
  },
  ADMINISTRATION: { CODE_INSEE_COMMUNE: '34172' },
  GEOLOCALISATION: { COORDONNEES_X: '3.86', COORDONNEES_Y: '43.61', SYSTEME_REFERENCE: 'WGS84' },
}

const UAI_DETAIL_ECOLE = {
  IDENTIFICATION: {
    NUMERO_UAI: '0340001A',
    NATURES: [{ CODE: '151' }], // école élémentaire → hors supérieur
    APPELLATIONS_OFFICIELLES: [{ VALEUR: 'Ecole primaire' }],
  },
  LOCALISATION: { CODE_POSTAL: '34090', LOCALITE_ACHEMINEMENT: 'MONTPELLIER' },
}

describe('ramsese service — getEtablissementsSuperieurByCodePostal', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.resetModules()
  })

  it('enchaîne CP → communes → UAIs → détails et ne garde que le supérieur', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([{ code: '34172', nom: 'Montpellier' }])) // geo.api communes
      .mockResolvedValueOnce(jsonResponse({ UAIS: ['0341089Z', '0340001A'] })) // filtres
      .mockResolvedValueOnce(jsonResponse(UAI_DETAIL_SUP)) // détail 1
      .mockResolvedValueOnce(jsonResponse(UAI_DETAIL_ECOLE)) // détail 2

    const { getEtablissementsSuperieurByCodePostal } = await import('./ramsese')
    const result = await getEtablissementsSuperieurByCodePostal('34090')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      numeroUai: '0341089Z',
      denomination: 'Université de Montpellier',
      sigle: 'UM',
      secteur: 'PU',
      adresse: '163 rue Auguste Broussonnet',
      codePostal: '34090',
      commune: 'MONTPELLIER',
      codeInseeCommune: '34172',
      coordonnees: { x: '3.86', y: '43.61', systemeReference: 'WGS84' },
    })
  })

  it('poste les communes INSEE (pas le code postal) au filtre RAMSESE', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([{ code: '34172', nom: 'Montpellier' }])) // communes
      .mockResolvedValueOnce(jsonResponse({ UAIS: [] })) // filtres

    const { getEtablissementsSuperieurByCodePostal } = await import('./ramsese')
    await getEtablissementsSuperieurByCodePostal('34090')

    const filtresCall = fetchMock.mock.calls[1]
    expect(filtresCall[0]).toContain('/listeUai/filtres')
    const body = JSON.parse(filtresCall[1].body)
    expect(body.communes).toEqual(['34172'])
  })

  it('inclut le code INSEE d’arrondissement pour Paris (75013 → 75056 + 75113)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([{ code: '75056', nom: 'Paris' }])) // communes
      .mockResolvedValueOnce(jsonResponse({ UAIS: [] })) // filtres

    const { getEtablissementsSuperieurByCodePostal } = await import('./ramsese')
    await getEtablissementsSuperieurByCodePostal('75013')

    const body = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(body.communes).toEqual(['75056', '75113'])
  })

  it('retourne [] quand le code postal est inconnu (aucun appel RAMSESE)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([])) // communes

    const { getEtablissementsSuperieurByCodePostal } = await import('./ramsese')
    const result = await getEtablissementsSuperieurByCodePostal('00000')

    expect(result).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('exclut les établissements dont le nom est un bouche-trou (accents/casse indifférents)', async () => {
    const UAI_DETAIL_A_COMPLETER = {
      IDENTIFICATION: {
        NUMERO_UAI: '0340002B',
        NATURES: [{ CODE: '520' }],
        APPELLATIONS_OFFICIELLES: [{ VALEUR: 'à compléter' }],
      },
      LOCALISATION: { CODE_POSTAL: '34090', LOCALITE_ACHEMINEMENT: 'MONTPELLIER' },
    }

    fetchMock
      .mockResolvedValueOnce(jsonResponse([{ code: '34172', nom: 'Montpellier' }]))
      .mockResolvedValueOnce(jsonResponse({ UAIS: ['0341089Z', '0340002B'] }))
      .mockResolvedValueOnce(jsonResponse(UAI_DETAIL_SUP))
      .mockResolvedValueOnce(jsonResponse(UAI_DETAIL_A_COMPLETER))

    const { getEtablissementsSuperieurByCodePostal } = await import('./ramsese')
    const result = await getEtablissementsSuperieurByCodePostal('34090')

    expect(result.map((e) => e.numeroUai)).toEqual(['0341089Z'])
  })

  it('normalise les variantes de « A COMPLETER »', async () => {
    const { _internal } = await import('./ramsese')
    const placeholders = ['A COMPLETER', 'à compléter', 'A Compléter', ' a-completer ', 'A_COMPLETER', 'Non renseigné', '', null]
    for (const value of placeholders) {
      expect(_internal.isPlaceholderDenomination(value)).toBe(true)
    }
    for (const value of ['Université de Montpellier', 'IUT à compléter les dossiers']) {
      expect(_internal.isPlaceholderDenomination(value)).toBe(false)
    }
  })

  it('retombe sur la dénomination principale si l’appellation officielle est un bouche-trou', async () => {
    const { _internal } = await import('./ramsese')
    const etab = _internal.toEtablissement({
      IDENTIFICATION: {
        NUMERO_UAI: '0341089Z',
        APPELLATIONS_OFFICIELLES: [{ VALEUR: 'A COMPLETER' }],
        DENOMINATIONS_PRINCIPALES: [{ VALEUR: 'Université de Montpellier' }],
      },
    })
    expect(etab?.denomination).toBe('Université de Montpellier')
  })

  it('exclut les établissements non ouverts (ETAT ≠ 1)', async () => {
    const UAI_DETAIL_FERME = {
      IDENTIFICATION: {
        NUMERO_UAI: '0340003C',
        ETAT: '3', // fermé
        NATURES: [{ CODE: '520' }],
        APPELLATIONS_OFFICIELLES: [{ VALEUR: 'Ancienne école supérieure' }],
      },
      LOCALISATION: { CODE_POSTAL: '34090', LOCALITE_ACHEMINEMENT: 'MONTPELLIER' },
    }

    fetchMock
      .mockResolvedValueOnce(jsonResponse([{ code: '34172', nom: 'Montpellier' }]))
      .mockResolvedValueOnce(jsonResponse({ UAIS: ['0341089Z', '0340003C'] }))
      .mockResolvedValueOnce(jsonResponse({ ...UAI_DETAIL_SUP, IDENTIFICATION: { ...UAI_DETAIL_SUP.IDENTIFICATION, ETAT: '1' } }))
      .mockResolvedValueOnce(jsonResponse(UAI_DETAIL_FERME))

    const { getEtablissementsSuperieurByCodePostal } = await import('./ramsese')
    const result = await getEtablissementsSuperieurByCodePostal('34090')

    expect(result.map((e) => e.numeroUai)).toEqual(['0341089Z'])
  })

  it('considère un ETAT absent comme ouvert (champ optionnel côté API)', async () => {
    const { _internal } = await import('./ramsese')
    expect(_internal.isOpenUai({ IDENTIFICATION: { NUMERO_UAI: '0341089Z' } })).toBe(true)
    expect(_internal.isOpenUai({ IDENTIFICATION: { NUMERO_UAI: '0341089Z', ETAT: '1' } })).toBe(true)
    expect(_internal.isOpenUai({ IDENTIFICATION: { NUMERO_UAI: '0341089Z', ETAT: '2' } })).toBe(false) // à ouvrir
    expect(_internal.isOpenUai({ IDENTIFICATION: { NUMERO_UAI: '0341089Z', ETAT: '3' } })).toBe(false) // fermé
  })

  it('exclut les natures fermées (DATE_FIN renseignée)', async () => {
    const { _internal } = await import('./ramsese')
    const etab = _internal.toEtablissement({
      IDENTIFICATION: {
        NUMERO_UAI: '0341089Z',
        NATURES: [{ CODE: '520', DATE_FIN: '2020-01-01T00:00:00' }],
      },
    })
    expect(etab?.natureCodes).toEqual([])
  })
})

describe('ramsese service — communes INSEE d’un code postal', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.resetModules()
  })

  it.each([
    ['75013', '75056', '75113'],
    ['75016', '75056', '75116'],
    ['75116', '75056', '75116'],
    ['69007', '69123', '69387'],
    ['13001', '13055', '13201'],
    ['13016', '13055', '13216'],
  ])('ajoute l’arrondissement municipal de %s sans interroger geo.api', async (cp, commune, arrondissement) => {
    fetchMock.mockResolvedValue(jsonResponse([{ code: commune, nom: 'Commune' }]))
    const { _internal } = await import('./ramsese')

    expect(await _internal.fetchInseeCodesByPostalCode(cp)).toEqual([commune, arrondissement])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('arrondissement')
  })

  it.each(['21000', '52200', '13100', '75', '69100'])('n’ajoute aucun arrondissement hors Paris, Lyon et Marseille (%s)', async (cp) => {
    fetchMock.mockResolvedValue(jsonResponse([{ code: '21231', nom: 'Commune' }]))
    const { _internal } = await import('./ramsese')

    expect(await _internal.fetchInseeCodesByPostalCode(cp)).toEqual(['21231'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('ramsese service — services externes qui ne répondent pas', () => {
  const hangingFetch = (_url: string, init?: { signal?: AbortSignal }) =>
    new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)))

  beforeEach(() => {
    fetchMock.mockReset()
    vi.resetModules()
    vi.useFakeTimers()
    fetchMock.mockImplementation(hangingFetch)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('abandonne geo.api au bout du délai et garde l’arrondissement connu', async () => {
    const { _internal } = await import('./ramsese')

    const result = _internal.fetchInseeCodesByPostalCode('69007')
    await vi.advanceTimersByTimeAsync(_internal.EXTERNAL_TIMEOUT_MS)

    await expect(result).resolves.toEqual(['69387'])
  })

  it('abandonne RAMSESE au bout du délai', async () => {
    const { _internal } = await import('./ramsese')

    const uais = _internal.fetchUaisByCommunes(['21231'])
    const detail = _internal.fetchUaiDetail('0341089Z')
    await vi.advanceTimersByTimeAsync(_internal.EXTERNAL_TIMEOUT_MS)

    await expect(uais).resolves.toEqual([])
    await expect(detail).resolves.toBeNull()
  })
})
