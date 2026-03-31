const DEFAULT_SOCIAL_HOUSING_APPLICATION_URL = 'https://www.demande-logement-social.gouv.fr/index'

const LOCAL_SOCIAL_HOUSING_APPLICATION_URLS: Record<string, string> = {
  '03': 'https://mademande03.dlauvergne.fr',
  '14': 'https://www.demandelogement14.fr',
  '15': 'https://mademande15.dlauvergne.fr',
  '16': 'https://www.demandedelogement16.fr',
  '17': 'https://www.demandedelogement17.fr',
  '21': 'https://www.demandelogementbourgognefranchecomte.fr',
  '22': 'https://www.demandelogement22.fr',
  '25': 'https://www.demandelogementbourgognefranchecomte.fr',
  '29': 'https://www.demandelogement29.fr',
  '31': 'https://www.demandelogement31.fr',
  '35': 'https://www.demandelogement35.fr',
  '37': 'https://www.demandelogement37.fr',
  '39': 'https://www.demandelogementbourgognefranchecomte.fr',
  '43': 'https://mademande43.dlauvergne.fr',
  '44': 'https://www.demandelogement44.fr',
  '49': 'https://www.demandelogement49.fr',
  '50': 'https://www.demandelogement50.fr',
  '53': 'https://www.demandelogement53.fr',
  '56': 'https://www.demandelogement56.fr',
  '58': 'https://www.demandelogementbourgognefranchecomte.fr',
  '61': 'https://www.demandelogement61.fr',
  '63': 'https://mademande63.dlauvergne.fr',
  '67': 'https://www.demandedelogement-alsace.fr',
  '68': 'https://www.demandedelogement-alsace.fr',
  '70': 'https://www.demandelogementbourgognefranchecomte.fr',
  '72': 'https://www.demandelogement72.fr',
  '79': 'https://www.demandedelogement79.fr',
  '85': 'https://www.demandelogement85.fr',
  '86': 'https://www.demandedelogement86.fr',
  '87': 'https://www.demandedelogement87.fr',
  '88': 'https://vosges.demandelogement88.fr',
  '89': 'https://www.demandelogementbourgognefranchecomte.fr',
  '90': 'https://www.demandelogementbourgognefranchecomte.fr',
}

export const getSocialHousingApplicationLink = (departmentCode?: string | null) => {
  const url = departmentCode ? LOCAL_SOCIAL_HOUSING_APPLICATION_URLS[departmentCode] : undefined

  return {
    label: url ? 'SDE' : 'SNE',
    url: url ?? DEFAULT_SOCIAL_HOUSING_APPLICATION_URL,
  }
}
