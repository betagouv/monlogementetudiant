'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { useTranslations } from 'next-intl'
import { useDeleteAccount } from '~/hooks/use-delete-account'

const deleteAccountModal = createModal({ id: 'delete-account-modal', isOpenedByDefault: false })

export const DeleteAccount = () => {
  const t = useTranslations('student.personalInformations.deleteAccount')
  const { mutate, isPending } = useDeleteAccount()

  return (
    <div className="fr-border-top fr-pt-5w">
      <h2 className="fr-h4">{t('title')}</h2>
      <p className="fr-text--sm fr-text-mention--grey">{t('description')}</p>

      <Button priority="secondary" iconId="ri-delete-bin-line" {...deleteAccountModal.buttonProps} disabled={isPending}>
        {t('cta')}
      </Button>

      <deleteAccountModal.Component
        title={t('confirmTitle')}
        buttons={[
          { children: t('cancel'), doClosesModal: true },
          { children: t('confirm'), onClick: () => mutate(), doClosesModal: true },
        ]}
      >
        <p>{t('confirmBody')}</p>
        <p className="fr-mb-0">{t('confirmWarning')}</p>
      </deleteAccountModal.Component>
    </div>
  )
}
