export enum EResidenceType {
  UNIVERSITAIRE_CONVENTIONNEE = 'residence-universitaire-conventionnee',
  RESIDENCE_ETUDIANTE = 'residence-etudiante',
  SOCIALE_JEUNES_ACTIFS = 'residence-sociale-jeunes-actifs',
  JEUNES_TRAVAILLEURS = 'foyer-jeunes-travailleurs',
  SOCIAL_CLASSIQUE = 'logement-social-classique',
  SOCIAL_FLECHE_JEUNE = 'loi-elan-article-109',
  ECOLE = 'residence-ecole',
  SOUS_LOCATION = 'sous-location',
  INTERGENERATIONNELLE = 'intergenerationnel',
}

export const RESIDENCE_TYPE_LABELS: Record<EResidenceType, string> = {
  [EResidenceType.UNIVERSITAIRE_CONVENTIONNEE]: 'Résidence universitaire conventionnée',
  [EResidenceType.RESIDENCE_ETUDIANTE]: 'Résidence étudiante',
  [EResidenceType.SOCIALE_JEUNES_ACTIFS]: 'Résidence Sociale Jeunes Actifs (RSJA, Habitat Jeunes)',
  [EResidenceType.JEUNES_TRAVAILLEURS]: 'Foyer de jeunes travailleurs (FJT)',
  [EResidenceType.SOCIAL_CLASSIQUE]: 'Logement social classique commercialisé en partie aux étudiants',
  [EResidenceType.SOCIAL_FLECHE_JEUNE]: 'Logement social fléché vers les jeunes (loi ELAN – article 109)',
  [EResidenceType.ECOLE]: "Résidence d'école ou d'établissement d'enseignement",
  [EResidenceType.SOUS_LOCATION]:
    'Logements sociaux sous-loués aux étudiants par une association via une convention ou un contrat spécifique',
  [EResidenceType.INTERGENERATIONNELLE]: 'Cohabitation intergénérationnelle',
}
