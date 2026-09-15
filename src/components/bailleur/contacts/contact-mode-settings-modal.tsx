'use client'

import { createModal } from '@codegouvfr/react-dsfr/Modal'
import MainSend from '@codegouvfr/react-dsfr/picto/MainSend'
import RadioButtons from '@codegouvfr/react-dsfr/RadioButtons'
import { useMutation, useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { AccommodationSelector } from '~/components/bailleur/accommodation-selector'
import { createToast } from '~/components/ui/createToast'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import dossierFacile from '~/images/dossier-facile.svg'
import type { TAccommodationSelection } from '~/schemas/accommodations/accommodation-selection'
import { useTRPC } from '~/server/trpc/client'
import { isDossierFacileSelectable } from '~/utils/feature-flags'

export const contactModeSettingsModal = createModal({
  id: 'contact-mode-settings-modal',
  isOpenedByDefault: false,
})

const MODE_OPTIONS: { mode: EOwnerContactMode; labelKey: string; hintKey: string; illustration?: React.ReactNode }[] = [
  {
    mode: EOwnerContactMode.CONTACTS,
    labelKey: 'contactsLabel',
    hintKey: 'contactsHint',
    illustration: <MainSend color="blue-ecume" width={64} height={64} />,
  },
  {
    mode: EOwnerContactMode.DOSSIER_FACILE,
    labelKey: 'dossierFacileLabel',
    hintKey: 'dossierFacileHint',
    illustration: <Image src={dossierFacile} alt="" width={64} height={64} />,
  },
  {
    mode: EOwnerContactMode.NONE,
    labelKey: 'noneLabel',
    hintKey: 'noneHint',
  },
]

interface Props {
  currentMode: EOwnerContactMode
  ownerId?: number
  resolvedOwnerId: number
}

export const ContactModeSettingsModal = ({ currentMode, ownerId, resolvedOwnerId }: Props) => {
  const t = useTranslations('bailleur.contacts.settingsModal')
  const trpc = useTRPC()
  const router = useRouter()
  const [mode, setMode] = useState<EOwnerContactMode>(currentMode)
  const [residences, setResidences] = useState<TAccommodationSelection>({ mode: 'all' })

  const { data: residenceOptions } = useQuery({
    ...trpc.bailleur.listOwnerResidences.queryOptions({ ownerId: resolvedOwnerId }),
    enabled: mode !== EOwnerContactMode.NONE,
  })

  useEffect(() => {
    const items = residenceOptions?.items as Array<{ id: number; acceptsApplications: boolean }> | undefined
    if (!items || items.length === 0) return
    const open = items.filter((r) => r.acceptsApplications)
    setResidences(open.length === items.length ? { mode: 'all' } : { mode: 'restricted', accommodationIds: open.map((r) => r.id) })
  }, [residenceOptions])

  const { mutate, isPending } = useMutation(
    trpc.bailleur.setContactMode.mutationOptions({
      onSuccess: () => {
        createToast({ priority: 'success', message: t('success') })
        contactModeSettingsModal.close()
        router.refresh()
      },
      onError: () => {
        createToast({ priority: 'error', message: t('error') })
      },
    }),
  )

  return (
    <contactModeSettingsModal.Component
      title={t('title')}
      buttons={[
        {
          children: t('cancel'),
          priority: 'secondary',
          disabled: isPending,
          onClick: () => setMode(currentMode),
        },
        {
          children: isPending ? t('saving') : t('save'),
          priority: 'primary',
          disabled: isPending,
          doClosesModal: false,
          onClick: () => mutate({ mode, ownerId, residences: mode === EOwnerContactMode.NONE ? undefined : residences }),
        },
      ]}
    >
      <p className="fr-text--sm fr-text-mention--grey">{t('description')}</p>
      <RadioButtons
        legend={t('legend')}
        classes={{ legend: 'fr-sr-only' }}
        options={MODE_OPTIONS.map((option) => {
          // DossierFacile pas encore ouvert en production, sauf pour un gestionnaire déjà activé
          // (par un admin) qui doit rester libre de revenir à son mode courant.
          const locked =
            option.mode === EOwnerContactMode.DOSSIER_FACILE &&
            !isDossierFacileSelectable() &&
            currentMode !== EOwnerContactMode.DOSSIER_FACILE
          const hint = t(option.hintKey)

          return {
            label: t(option.labelKey),
            hintText: locked ? t('lockedHint', { hint }) : hint,
            // Clé omise si absente : DSFR rend sinon un bloc illustration vide.
            ...(option.illustration ? { illustration: option.illustration } : {}),
            nativeInputProps: {
              value: option.mode,
              checked: mode === option.mode,
              disabled: isPending || locked,
              onChange: () => setMode(option.mode),
            },
          }
        })}
      />

      {mode !== EOwnerContactMode.NONE && (
        <AccommodationSelector
          ownerId={resolvedOwnerId}
          namespace="bailleur.contacts.settingsModal.residences"
          value={residences}
          onChange={setResidences}
        />
      )}
    </contactModeSettingsModal.Component>
  )
}
