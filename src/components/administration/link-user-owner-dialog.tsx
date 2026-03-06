'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useDebounce } from 'use-debounce'
import { createToast } from '~/components/ui/createToast'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

const linkModal = createModal({
  id: 'link-user-owner-modal',
  isOpenedByDefault: false,
})

interface LinkUserOwnerDialogProps {
  userId: string
  currentOwnerId: number | null
  currentOwnerName?: string | null
}

export const LinkUserOwnerDialog = ({ userId, currentOwnerId, currentOwnerName }: LinkUserOwnerDialogProps) => {
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [selectedOwner, setSelectedOwner] = useState<{ id: number; name: string } | null>(
    currentOwnerId && currentOwnerName ? { id: currentOwnerId, name: currentOwnerName } : null,
  )
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const [debouncedSearch] = useDebounce(search, 300)

  const { data: ownersList } = useQuery({
    ...trpc.admin.owners.list.queryOptions({ page: 1, search: debouncedSearch }),
    enabled: debouncedSearch.length >= 2,
  })

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearch(value)
    setSelectedOwner(null)
    setIsOpen(value.length >= 2)
  }

  const handleSelectOwner = (owner: { id: number; name: string }) => {
    setSelectedOwner(owner)
    setSearch(owner.name)
    setIsOpen(false)
  }

  const handleSelectNone = () => {
    setSelectedOwner(null)
    setSearch('')
    setIsOpen(false)
  }

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (selectedOwner) {
        return trpcClient.admin.users.linkToOwner.mutate({
          userId,
          ownerId: selectedOwner.id,
        })
      } else {
        return trpcClient.admin.users.unlinkFromOwner.mutate({ userId })
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: trpc.admin.users.getById.queryKey({ id: userId }) })
      createToast({ priority: 'success', message: 'Lien mis a jour' })
      linkModal.close()
    },
    onError: () => {
      createToast({ priority: 'error', message: 'Erreur lors de la mise a jour du lien' })
    },
  })

  const handleOpen = () => {
    setSearch(selectedOwner?.name ?? currentOwnerName ?? '')
    setSelectedOwner(currentOwnerId && currentOwnerName ? { id: currentOwnerId, name: currentOwnerName } : null)
    setIsOpen(false)
    linkModal.open()
  }

  return (
    <>
      <Button priority="secondary" size="small" onClick={handleOpen}>
        {currentOwnerId ? 'Modifier le lien gestionnaire' : "Lier l'utilisateur à un gestionnaire"}
      </Button>

      <linkModal.Component title={currentOwnerId ? 'Modifier le lien utilisateur - gestionnaire' : "Lier l'utilisateur à un gestionnaire"}>
        <div ref={containerRef} style={{ position: 'relative', marginBottom: '1rem' }}>
          <Input
            label="Gestionnaire"
            classes={{ root: 'fr-mb-0' }}
            nativeInputProps={{
              value: search,
              onChange: handleInputChange,
              placeholder: 'Rechercher un gestionnaire...',
              onFocus: () => search.length >= 2 && !selectedOwner && setIsOpen(true),
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
              {currentOwnerId && (
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
                  Aucun gestionnaire (délier)
                </button>
              )}
              {ownersList?.items.map((owner) => (
                <button
                  type="button"
                  key={owner.id}
                  onClick={() => handleSelectOwner({ id: owner.id, name: owner.name })}
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
        <div className="fr-flex fr-flex-gap-2v fr-mt-2w">
          <Button onClick={() => linkMutation.mutate()} disabled={linkMutation.isPending || (!selectedOwner && !currentOwnerId)}>
            {linkMutation.isPending ? 'En cours...' : 'Valider'}
          </Button>
          <Button priority="secondary" onClick={() => linkModal.close()}>
            Annuler
          </Button>
        </div>
      </linkModal.Component>
    </>
  )
}
