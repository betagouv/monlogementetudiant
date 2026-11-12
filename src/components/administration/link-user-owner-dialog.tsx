'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { OwnerPicker } from '~/components/administration/owner-picker'
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

  const [selectedOwner, setSelectedOwner] = useState<{ id: number; name: string } | null>(
    currentOwnerId && currentOwnerName ? { id: currentOwnerId, name: currentOwnerName } : null,
  )

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
    setSelectedOwner(currentOwnerId && currentOwnerName ? { id: currentOwnerId, name: currentOwnerName } : null)
    linkModal.open()
  }

  return (
    <>
      <Button priority="secondary" size="small" onClick={handleOpen}>
        {currentOwnerId ? 'Modifier le lien gestionnaire' : "Lier l'utilisateur à un gestionnaire"}
      </Button>

      <linkModal.Component title={currentOwnerId ? 'Modifier le lien utilisateur - gestionnaire' : "Lier l'utilisateur à un gestionnaire"}>
        <OwnerPicker
          label="Gestionnaire"
          value={selectedOwner}
          onChange={setSelectedOwner}
          clearLabel={currentOwnerId ? 'Aucun gestionnaire (délier)' : undefined}
        />
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
