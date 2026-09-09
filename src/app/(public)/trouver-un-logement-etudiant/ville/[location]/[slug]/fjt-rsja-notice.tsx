'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import styles from './accommodation-residence.module.css'

const fjtRsjaModal = createModal({
  id: 'fjt-rsja-modal',
  isOpenedByDefault: false,
})

export const FjtRsjaNotice = () => {
  const t = useTranslations('accomodation')

  return (
    <>
      <div className="fr-flex fr-direction-column fr-direction-md-row fr-align-items-md-center fr-flex-gap-2v fr-border fr-px-3w fr-py-2w">
        <span className={clsx('ri-briefcase-line fr-hidden fr-unhidden-sm', styles.fjtIcon)} aria-hidden />
        <p className="fr-mb-0 fr-flex fr-direction-column fr-flex-gap-1v">
          <span>
            <span className="fr-text--bold">{t('fjtRsjaNoticeText')} </span>
            {t('fjtRsjaNoticeDescription')}
          </span>
          <Button priority="tertiary no outline" className="fr-link fr-text--underline" size="small" {...fjtRsjaModal.buttonProps}>
            {t('fjtRsjaLearnMore')}
          </Button>
        </p>
      </div>

      <fjtRsjaModal.Component
        title={t('fjtRsjaModalTitle')}
        buttons={[
          {
            priority: 'secondary',
            children: t('fjtRsjaModalClose'),
            onClick: () => fjtRsjaModal.close(),
          },
        ]}
      >
        <p>{t('fjtRsjaModalParagraph1')}</p>
        <p>{t('fjtRsjaModalParagraph2')}</p>
      </fjtRsjaModal.Component>
    </>
  )
}
