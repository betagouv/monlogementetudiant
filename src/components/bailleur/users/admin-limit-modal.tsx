'use client'

import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { useTranslations } from 'next-intl'
import { MAX_BAILLEUR_ADMINISTRATORS } from '~/server/bailleur/permissions'

export const adminLimitModal = createModal({
  id: 'bailleur-admin-limit',
  isOpenedByDefault: false,
})

/**
 * Ouverte a la soumission du formulaire quand le bailleur a deja atteint son plafond d'administrateurs.
 * Le refus est aussi tenu cote serveur : cette modale evite l'aller-retour, elle ne le remplace pas.
 */
export const AdminLimitReachedModal = () => {
  const t = useTranslations('bailleur.users.adminLimit')

  return (
    <adminLimitModal.Component title={t('modalTitle')} buttons={[{ children: t('close'), doClosesModal: true }]}>
      {t('body', { max: MAX_BAILLEUR_ADMINISTRATORS })}
    </adminLimitModal.Component>
  )
}
