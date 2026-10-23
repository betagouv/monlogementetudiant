'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Document from '@codegouvfr/react-dsfr/picto/Document'
import ErrorPicto from '@codegouvfr/react-dsfr/picto/Error'
import Success from '@codegouvfr/react-dsfr/picto/Success'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { createToast } from '~/components/ui/createToast'
import { EContactSource } from '~/enums/contact-source'
import { CONTACT_RETENTION_DAYS, EContactStatus } from '~/enums/contact-status'
import { useSignedDocumentUrl } from '~/hooks/use-signed-document-url'
import type { TContactDetail } from '~/schemas/contacts/contact-detail'
import { useTRPC } from '~/server/trpc/client'
import { daysLeftFrom } from '~/utils/date-helpers'
import { sPluriel } from '~/utils/sPluriel'
import styles from './contact-detail.module.css'

interface Props {
  contact: TContactDetail
  source: EContactSource
  /** Identifiant du locataire DossierFacile (mode `dossier_facile` uniquement). */
  dfTenantId?: string
}

const PANEL_CLASSNAME = 'fr-background-default--grey fr-border fr-p-3w fr-text--center'

export const ContactDetailActions = ({ contact, source, dfTenantId }: Props) => {
  const t = useTranslations('bailleur.contacts.actions')
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { openDocument, isLoading: isOpeningDocument } = useSignedDocumentUrl()
  const { id, status, createdAt } = contact

  const { mutate, isPending } = useMutation(
    trpc.bailleur.updateContactStatus.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey:
              source === EContactSource.DOSSIER_FACILE
                ? trpc.bailleur.getCandidature.queryKey({ id })
                : trpc.bailleur.getContact.queryKey({ id }),
          }),
          queryClient.invalidateQueries({ queryKey: trpc.bailleur.listContactsByResidence.queryKey() }),
          queryClient.invalidateQueries({ queryKey: trpc.bailleur.listResidencesWithContactCounts.queryKey() }),
        ])
      },
      onError: () => {
        createToast({ priority: 'error', message: t('statusChangeError') })
      },
    }),
  )

  const updateStatus = (next: EContactStatus) => mutate({ id, status: next, source })

  const accessDossierFacile = () => {
    if (dfTenantId) openDocument('tenantUrl', dfTenantId)
    updateStatus(EContactStatus.A_CONTACTER)
  }

  if (status === EContactStatus.CONTACTE) {
    // Le décompte part de la date de dépôt, pas de celle du traitement : c'est `created_at` qui
    // déclenche la disparition, sans quoi le nombre affiché ne collerait pas à la date réelle.
    const daysLeft = daysLeftFrom(createdAt, CONTACT_RETENTION_DAYS)

    return (
      <div className={clsx(PANEL_CLASSNAME, styles.actionsPanel)}>
        <Success color="green-emeraude" width={64} height={64} />

        <p className="fr-h5">{t('contactedTitle')}</p>
        {daysLeft !== null && <p>{t('contactedRetention', { days: daysLeft, s: sPluriel(daysLeft) })}</p>}
      </div>
    )
  }

  if (status === EContactStatus.NON_RETENU) {
    return (
      <div className={clsx(PANEL_CLASSNAME, styles.actionsPanel)}>
        <ErrorPicto width={64} height={64} />

        <p className="fr-h5">{t('rejectedTitle')}</p>
        <p>{t('rejectedDescription')}</p>
      </div>
    )
  }

  if (status === EContactStatus.A_MODERER) {
    return (
      <div className={clsx(PANEL_CLASSNAME, styles.actionsPanel)}>
        <span className={clsx('ri-file-list-3-line fr-display-block fr-text-title--blue-france', styles.actionsIcon)} aria-hidden="true" />
        <p className="fr-text--bold fr-mb-2w">{t('moderateTitle')}</p>
        <div className="fr-flex fr-direction-column fr-flex-gap-2v">
          <Button
            priority="secondary"
            iconId="ri-check-line"
            onClick={accessDossierFacile}
            disabled={isPending || isOpeningDocument || !dfTenantId}
          >
            {t('moderateAccess')}
          </Button>
          <Button
            priority="tertiary no outline"
            iconId="ri-close-line"
            onClick={() => updateStatus(EContactStatus.NON_RETENU)}
            disabled={isPending}
          >
            {t('moderateReject')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={clsx(PANEL_CLASSNAME, styles.actionsPanel)}>
      <Document color="blue-ecume" width={64} height={64} />
      <p className="fr-h5">{t('toContactTitle')}</p>
      <div className="fr-flex fr-direction-column fr-flex-gap-4v fr-align-items-center fr-justify-content-center">
        <Button
          className="fr-width-full fr-flex fr-justify-content-center"
          priority="tertiary"
          iconId="ri-check-line"
          onClick={() => updateStatus(EContactStatus.CONTACTE)}
          disabled={isPending}
        >
          {t('toContactConfirm')}
        </Button>
        <Button
          className="fr-width-full fr-flex fr-justify-content-center"
          priority="tertiary"
          onClick={() => updateStatus(EContactStatus.NON_RETENU)}
          disabled={isPending}
        >
          {source === EContactSource.DOSSIER_FACILE ? t('toContactRejectDossierFacile') : t('toContactRejectContact')}
        </Button>
      </div>
    </div>
  )
}
