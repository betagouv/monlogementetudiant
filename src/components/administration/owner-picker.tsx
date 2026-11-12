'use client'

import Input from '@codegouvfr/react-dsfr/Input'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useDebounce } from 'use-debounce'
import type { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { useTRPC } from '~/server/trpc/client'

export type TPickedOwner = { id: number; name: string; contactMode?: EOwnerContactMode }

interface OwnerPickerProps {
  value: TPickedOwner | null
  onChange: (owner: TPickedOwner | null) => void
  label: string
  hintText?: string
  /** Affiche une entrée pour désélectionner (ex. « Aucun gestionnaire (délier) »). */
  clearLabel?: string
}

export const OwnerPicker = ({ value, onChange, label, hintText, clearLabel }: OwnerPickerProps) => {
  const trpc = useTRPC()
  const [search, setSearch] = useState(value?.name ?? '')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const emittedId = useRef<number | undefined>(value?.id)

  const [debouncedSearch] = useDebounce(search, 300)

  const { data: ownersList } = useQuery({
    ...trpc.admin.owners.list.queryOptions({ page: 1, search: debouncedSearch }),
    enabled: debouncedSearch.length >= 2,
  })

  // Resynchronise le champ quand le parent change la valeur (ouverture de modale, réinitialisation).
  useEffect(() => {
    if (value?.id === emittedId.current) return
    emittedId.current = value?.id
    setSearch(value?.name ?? '')
    setIsOpen(false)
  }, [value])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const emit = (owner: TPickedOwner | null) => {
    emittedId.current = owner?.id
    onChange(owner)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setSearch(next)
    if (value) emit(null)
    setIsOpen(next.length >= 2)
  }

  const handleSelectOwner = (owner: TPickedOwner) => {
    emit(owner)
    setSearch(owner.name)
    setIsOpen(false)
  }

  const handleSelectNone = () => {
    emit(null)
    setSearch('')
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', marginBottom: '1rem' }}>
      <Input
        label={label}
        hintText={hintText}
        classes={{ root: 'fr-mb-0' }}
        nativeInputProps={{
          value: search,
          onChange: handleInputChange,
          placeholder: 'Rechercher un gestionnaire...',
          onFocus: () => search.length >= 2 && !value && setIsOpen(true),
        }}
      />
      {isOpen && debouncedSearch.length >= 2 && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: 'white',
            border: '1px solid var(--border-default-grey)',
            borderRadius: '0 0 4px 4px',
            maxHeight: '200px',
            overflowY: 'auto',
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
          }}
        >
          {clearLabel && (
            <button
              type="button"
              onClick={handleSelectNone}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.5rem 1rem',
                border: 'none',
                background: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontStyle: 'italic',
                color: 'var(--text-mention-grey)',
              }}
            >
              {clearLabel}
            </button>
          )}
          {ownersList?.items.map((owner) => (
            <button
              type="button"
              key={owner.id}
              onClick={() => handleSelectOwner({ id: owner.id, name: owner.name, contactMode: owner.contactMode })}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.5rem 1rem',
                border: 'none',
                background: 'none',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span>{owner.name}</span>
              <span style={{ marginLeft: '0.5rem', color: 'var(--text-mention-grey)', fontSize: '0.85rem' }}>{owner.slug}</span>
            </button>
          ))}
          {ownersList?.items.length === 0 && (
            <div style={{ padding: '0.5rem 1rem', color: 'var(--text-mention-grey)' }}>Aucun résultat</div>
          )}
        </div>
      )}
    </div>
  )
}
