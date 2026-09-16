/**
 * DossierFacile n'est pas encore ouvert aux gestionnaires en production ni en staging : ils ne peuvent pas
 * choisir ce mode de réception des candidatures eux-mêmes (un admin plateforme peut toujours
 * l'activer au cas par cas depuis l'administration).
 *
 * Fonction et non constante : lue à l'appel, donc stubbable en test (`vi.stubEnv`).
 */
export const isDossierFacileSelectable = () =>
  process.env.NEXT_PUBLIC_APP_ENV !== 'production' && process.env.NEXT_PUBLIC_APP_ENV !== 'staging'
