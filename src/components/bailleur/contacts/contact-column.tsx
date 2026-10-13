'use client'

import { useDraggable, useDroppable } from '@dnd-kit/core'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import type { CSSProperties } from 'react'
import { CONTACT_STATUS_CONFIG, EContactStatus } from '~/enums/contact-status'
import { ContactCard, type ContactItem } from './contact-card'
import styles from './contact-column.module.css'

const COLUMN_ICON: Record<EContactStatus, string> = {
  [EContactStatus.A_MODERER]: 'ri-team-line',
  [EContactStatus.NON_RETENU]: 'ri-close-circle-line',
  [EContactStatus.A_CONTACTER]: 'ri-time-line',
  [EContactStatus.CONTACTE]: 'ri-checkbox-circle-line',
}

/** La colonne d'entrée du board porte toujours l'icône « équipe » dorée, quel que soit son statut. */
const ENTRY_ICON = 'ri-team-line'
const ENTRY_COLOR = CONTACT_STATUS_CONFIG[EContactStatus.A_MODERER].barColor

const DraggableCard = ({ contact, slug }: { contact: ContactItem; slug: string }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: contact.id })

  return (
    <ContactCard
      ref={setNodeRef}
      contact={contact}
      slug={slug}
      className={clsx(isDragging && styles.dragging)}
      {...attributes}
      {...listeners}
    />
  )
}

interface Props {
  status: EContactStatus
  items: ContactItem[]
  slug: string
  /** Première colonne du board (les candidatures/demandes qui arrivent). */
  isEntry?: boolean
}

export const ContactColumn = ({ status, items, slug, isEntry = false }: Props) => {
  const t = useTranslations('bailleur.contacts.status')
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const config = CONTACT_STATUS_CONFIG[status]

  return (
    <div className={clsx('fr-flex fr-direction-column', styles.column)}>
      <div className="fr-flex fr-align-items-center fr-mb-2w">
        <span
          className={clsx(isEntry ? ENTRY_ICON : COLUMN_ICON[status], styles.icon)}
          style={{ '--column-icon-color': isEntry ? ENTRY_COLOR : config.barColor } as CSSProperties}
          aria-hidden="true"
        />
        <div className="fr-flex fr-flex-gap-2v">
          <span className="fr-text--lg fr-text--bold fr-mb-0">{t(status)}</span>({items.length})
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={clsx(
          'fr-flex fr-direction-column fr-flex-gap-4v fr-p-1v fr-border-radius--4',
          styles.dropzone,
          isOver && styles.dropzoneOver,
        )}
      >
        {items.length === 0 ? (
          <div className={clsx('fr-border', styles.emptyCell)} aria-hidden="true" />
        ) : (
          items.map((item) => <DraggableCard key={item.id} contact={item} slug={slug} />)
        )}
      </div>
    </div>
  )
}
