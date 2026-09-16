'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Binders from '@codegouvfr/react-dsfr/picto/Binders'
import MainSend from '@codegouvfr/react-dsfr/picto/MainSend'
import { useMutation } from '@tanstack/react-query'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createToast } from '~/components/ui/createToast'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import dossierFacile from '~/images/dossier-facile.svg'
import { useTRPC } from '~/server/trpc/client'
import { isDossierFacileSelectable } from '~/utils/feature-flags'

interface Props {
  /** Le mode de contact vaut pour tout le bailleur : seul un administrateur peut l'activer. */
  isAdministrator: boolean
}

export const ContactsLanding = ({ isAdministrator }: Props) => {
  const t = useTranslations('bailleur.contacts.landing')
  const trpc = useTRPC()
  const router = useRouter()
  const searchParams = useSearchParams()
  const ownerId = searchParams.get('ownerId') ? Number(searchParams.get('ownerId')) : undefined

  const { mutate, isPending } = useMutation(
    trpc.bailleur.setContactMode.mutationOptions({
      onSuccess: () => {
        createToast({ priority: 'success', message: t('activationSuccess') })
        router.refresh()
      },
      onError: () => {
        createToast({ priority: 'error', message: t('activationError') })
      },
    }),
  )

  const activate = (mode: Exclude<EOwnerContactMode, EOwnerContactMode.NONE>) => mutate({ mode, ownerId })

  const dossierFacileSelectable = isDossierFacileSelectable()

  return (
    <div className="fr-flex fr-direction-column fr-align-items-center fr-border fr-background-default--grey fr-col-12 fr-py-6w">
      <div className="fr-col-8">
        <div className="fr-flex fr-direction-column fr-flex-gap-4v fr-align-items-center">
          <Binders color="blue-ecume" width={80} height={80} />
          <h2 className="fr-h3 fr-text--center fr-mb-0">{t('title')}</h2>
          <p className="fr-text--center fr-text--lg">{t('subtitle')}</p>
          {!isAdministrator && <p className="fr-text--center fr-text-mention--grey">{t('administratorOnly')}</p>}
        </div>

        <div className="fr-flex fr-direction-column fr-direction-md-row">
          <div className="fr-flex fr-direction-column fr-justify-content-space-between fr-border fr-p-3w fr-flex-gap-3v fr-width-full">
            <MainSend color="blue-ecume" width={80} height={80} />

            <h3 className="fr-h5 fr-text-title--blue-france fr-mb-0">{t('contactsTitle')}</h3>
            <p className="fr-text--sm fr-mb-0">{t('contactsDescription')}</p>
            {isAdministrator && (
              <Button priority="secondary" disabled={isPending} onClick={() => activate(EOwnerContactMode.CONTACTS)} size="small">
                {t('contactsCta')}
              </Button>
            )}
          </div>

          <div className="fr-flex fr-align-items-center fr-justify-content-center fr-px-4w" aria-hidden="true">
            {t('or')}
          </div>

          <div className="fr-flex fr-direction-column fr-justify-content-space-between fr-border fr-p-3w fr-flex-gap-3v fr-width-full">
            <Image src={dossierFacile} alt={t('dossierFacileLogoAlt')} />

            <h3 className="fr-h5 fr-text-title--blue-france fr-mb-0">{t('dossierFacileTitle')}</h3>
            <p className="fr-text--sm fr-mb-0">{t('dossierFacileDescription')}</p>
            {isAdministrator && (
              <div className="fr-flex fr-direction-column fr-flex-gap-1v">
                <Button
                  priority="primary"
                  disabled={isPending || !dossierFacileSelectable}
                  onClick={() => activate(EOwnerContactMode.DOSSIER_FACILE)}
                  size="small"
                >
                  {t('dossierFacileCta')}
                </Button>
                {!dossierFacileSelectable && <span className="fr-text--xs fr-text-mention--grey fr-mb-0">{t('comingSoon')}</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
