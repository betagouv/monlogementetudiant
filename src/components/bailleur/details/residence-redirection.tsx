'use client'

import { useTranslations } from 'next-intl'
import { useFormContext } from 'react-hook-form'
import { RequiredLabel } from '~/components/ui/required-mark'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'

export const ResidenceRedirection = ({ className }: { className?: string }) => {
  const t = useTranslations('bailleur.residences.details.redirection')
  const {
    register,
    formState: { errors },
  } = useFormContext<TUpdateResidence>()
  return (
    <div className={className}>
      <div className="fr-px-2w fr-px-md-6w fr-pt-6w fr-pt-md-6w fr-pb-0">
        <div className="fr-flex fr-direction-column">
          <span className="fr-mb-0">
            <RequiredLabel>{t('label')}</RequiredLabel>
          </span>
          <span id="accommodation-redirection-hint" className="fr-mb-0 fr-text--xs fr-text-mention--grey">
            {t('hint')}
          </span>
        </div>
        <textarea
          className={`fr-input fr-mt-2w ${errors.externalUrl ? 'fr-input--error' : ''}`}
          aria-describedby="accommodation-redirection-hint"
          id="accommodation-redirection"
          rows={2}
          {...register('externalUrl')}
        />
        {errors.externalUrl && <p className="fr-error-text fr-mt-1v">{errors.externalUrl.message}</p>}
      </div>
    </div>
  )
}
