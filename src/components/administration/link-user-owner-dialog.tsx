'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import Select from '@codegouvfr/react-dsfr/Select'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createToast } from '~/components/ui/createToast'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

const linkModal = createModal({
  id: 'link-user-owner-modal',
  isOpenedByDefault: false,
})

interface LinkUserOwnerDialogProps {
  userId: string
  currentOwnerId: number | null
}

export const LinkUserOwnerDialog = ({ userId, currentOwnerId }: LinkUserOwnerDialogProps) => {
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const queryClient = useQueryClient()
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>(currentOwnerId?.toString() ?? '')

  const { data: ownersList } = useQuery(trpc.admin.owners.list.queryOptions({ page: 1 }))

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (selectedOwnerId) {
        return trpcClient.admin.users.linkToOwner.mutate({
          userId,
          ownerId: Number(selectedOwnerId),
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

  return (
    <>
      <Button priority="secondary" size="small" onClick={() => linkModal.open()}>
        {currentOwnerId ? 'Modifier le lien gestionnaire' : "Lier l'utilisateur à un gestionnaire"}
      </Button>

      <linkModal.Component title={currentOwnerId ? 'Modifier le lien utilisateur - gestionnaire' : "Lier l'utilisateur à un gestionnaire"}>
        <Select
          label="Gestionnaire"
          nativeSelectProps={{
            value: selectedOwnerId,
            onChange: (e) => setSelectedOwnerId(e.target.value),
          }}
        >
          <option value="">Aucun gestionnaire</option>
          {ownersList?.items.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.name}
            </option>
          ))}
        </Select>
        <div className="fr-flex fr-flex-gap-2v fr-mt-2w">
          <Button onClick={() => linkMutation.mutate()} disabled={linkMutation.isPending}>
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
