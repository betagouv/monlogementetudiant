'use client'

import Select from '@codegouvfr/react-dsfr/Select'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

interface OwnerSwitcherProps {
  owners: Array<{ id: number; name: string; slug: string }>
}

export function OwnerSwitcher({ owners }: OwnerSwitcherProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentBailleur = searchParams.get('bailleur')

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('bailleur', value)
      } else {
        params.delete('bailleur')
      }
      // Reset page when switching owner
      params.delete('page')
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  return (
    <div style={{ minWidth: '200px' }}>
      <Select
        label={null}
        nativeSelectProps={{
          value: currentBailleur ?? '',
          onChange: handleChange,
        }}
      >
        {owners.map((owner) => (
          <option key={owner.id} value={owner.id}>
            {owner.name}
          </option>
        ))}
      </Select>
    </div>
  )
}
