'use client'

import { DndContext, type DragEndEvent, DragOverlay, type DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { createToast } from '~/components/ui/createToast'
import { columnsForMode, EContactStatus } from '~/enums/contact-status'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { useTRPC } from '~/server/trpc/client'
import { ContactCard, type ContactItem } from './contact-card'
import { ContactColumn } from './contact-column'

interface Props {
  slug: string
}

/** Référence stable : évite de recréer un tableau vide à chaque rendu tant que la requête charge. */
const NO_ITEMS: ContactItem[] = []

export const ContactsBoard = ({ slug }: Props) => {
  const t = useTranslations('bailleur.contacts')
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const boardQueryKey = trpc.bailleur.listContactsByResidence.queryKey({ slug })
  const { data } = useQuery(trpc.bailleur.listContactsByResidence.queryOptions({ slug }))

  // Le cache de la requête est la seule source de vérité : le déplacement d'une carte l'écrit
  // directement (optimistic update), plutôt que d'entretenir une copie locale à resynchroniser.
  const items = data?.items ?? NO_ITEMS
  const [activeId, setActiveId] = useState<string | null>(null)

  const mode = data?.mode ?? EOwnerContactMode.NONE
  const columns = mode === EOwnerContactMode.NONE ? [] : columnsForMode(mode)

  const { mutate } = useMutation(
    trpc.bailleur.updateContactStatus.mutationOptions({
      onMutate: async ({ id, status }) => {
        await queryClient.cancelQueries({ queryKey: boardQueryKey })
        const previous = queryClient.getQueryData(boardQueryKey)
        queryClient.setQueryData(boardQueryKey, (board) =>
          board ? { ...board, items: board.items.map((item) => (item.id === id ? { ...item, status } : item)) } : board,
        )
        return { previous }
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.bailleur.listResidencesWithContactCounts.queryKey() })
        queryClient.invalidateQueries({ queryKey: trpc.bailleur.contactStats.queryKey() })
      },
      onError: (_error, _variables, context) => {
        // Restauration immédiate de l'instantané précédent, sans aller-retour serveur.
        if (context?.previous) queryClient.setQueryData(boardQueryKey, context.previous)
        createToast({ priority: 'error', message: t('statusChangeError') })
      },
    }),
  )

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const activeItem = items.find((item) => item.id === activeId) ?? null

  const resolveTargetStatus = (overId: string): EContactStatus | null => {
    if (columns.includes(overId as EContactStatus)) return overId as EContactStatus
    return (items.find((i) => i.id === overId)?.status as EContactStatus) ?? null
  }

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const item = items.find((i) => i.id === active.id)
    const target = resolveTargetStatus(String(over.id))
    if (!item || !target || item.status === target) return

    mutate({ id: item.id, status: target, source: item.source })
  }

  return (
    <div className="fr-border fr-p-3w">
      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="fr-grid-row fr-grid-row--gutters">
          {columns.map((status, index) => (
            <div key={status} className="fr-col-12 fr-col-md">
              <ContactColumn status={status} slug={slug} isEntry={index === 0} items={items.filter((i) => i.status === status)} />
            </div>
          ))}
        </div>

        <DragOverlay>{activeItem ? <ContactCard contact={activeItem} slug={slug} overlay /> : null}</DragOverlay>
      </DndContext>
    </div>
  )
}
