'use client'

import { useTranslations } from 'next-intl'
import { useFormContext } from 'react-hook-form'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'

export const ResidenceVirtualTour = () => {
  const t = useTranslations('bailleur.residences.details.virtualTour')
  const { register } = useFormContext<TUpdateResidence>()
  return (
    <div className="fr-border-bottom">
      <div className="fr-p-2w fr-p-md-6w">
        <h3>{t('title')}</h3>
        <div className="fr-flex fr-direction-column">
          <span className="fr-mb-0">{t('label')}</span>
          <span className="fr-mb-0 fr-text--xs fr-text-mention--grey">{t('hint')}</span>
        </div>
        <textarea className="fr-input fr-mt-2w" id="accommodation-virtual-tour" rows={6} {...register('virtualTourUrl')} />
      </div>
    </div>
  )
}
