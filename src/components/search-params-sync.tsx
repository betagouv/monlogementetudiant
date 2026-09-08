'use client'

import { parseAsString, useQueryStates } from 'nuqs'
import { useEffect } from 'react'

/**
 * Recopie dans l'URL le territoire résolu côté serveur, quand il n'y est pas déjà.
 *
 * Seules les académies passent encore par un paramètre d'URL : villes et départements sont
 * déduits du pathname et filtrés sur leur frontière, sans bbox intermédiaire.
 */
export function SearchParamsSync({ academie }: { academie?: string }) {
  const [queryStates, setQueryStates] = useQueryStates({
    academie: parseAsString,
  })

  useEffect(() => {
    if (academie && !queryStates.academie) {
      setQueryStates({ academie }, { history: 'replace', shallow: true })
    }
  }, [])

  return null
}
