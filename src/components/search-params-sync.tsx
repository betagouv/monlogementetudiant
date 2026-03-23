'use client'

import { parseAsString, useQueryStates } from 'nuqs'
import { useEffect } from 'react'

export function SearchParamsSync({ bbox, academie }: { bbox?: string; academie?: string }) {
  const [queryStates, setQueryStates] = useQueryStates({
    bbox: parseAsString,
    academie: parseAsString,
  })

  useEffect(() => {
    const updates: Record<string, string> = {}
    if (bbox && !queryStates.bbox) updates.bbox = bbox
    if (academie && !queryStates.academie) updates.academie = academie
    if (Object.keys(updates).length > 0) {
      setQueryStates(updates, { history: 'replace', shallow: true })
    }
  }, [])

  return null
}
