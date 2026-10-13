'use client'

import Input from '@codegouvfr/react-dsfr/Input'
import { useTranslations } from 'next-intl'
import { useFormContext } from 'react-hook-form'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'

export const ResidenceVirtualTour = () => {
  const t = useTranslations('bailleur.residences.details.virtualTour')
  const {
    register,
    formState: { errors },
  } = useFormContext<TUpdateResidence>()
  const error = errors.virtualTourUrl?.message
  return (
    <div className="fr-border-bottom">
      <div className="fr-p-2w fr-p-md-6w">
        <h3>{t('title')}</h3>
        <Input
          label={t('label')}
          hintText={t('hint')}
          textArea
          nativeTextAreaProps={{ id: 'accommodation-virtual-tour', rows: 6, ...register('virtualTourUrl') }}
          state={error ? 'error' : 'default'}
          stateRelatedMessage={error}
        />
      </div>
    </div>
  )
}
