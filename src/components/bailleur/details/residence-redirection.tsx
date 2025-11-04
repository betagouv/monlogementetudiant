'use client'

import { useFormContext } from 'react-hook-form'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'

export const ResidenceRedirection = () => {
  const {
    register,
    formState: { errors },
  } = useFormContext<TUpdateResidence>()
  return (
    <div className="fr-border-top">
      <div className="fr-p-6w">
        <span className="fr-pb-2w">
          URL de redirection <span className="fr-text-default--error">*</span>
        </span>
        <textarea
          className={`fr-input fr-mt-2w ${errors.external_url ? 'fr-input--error' : ''}`}
          aria-describedby={'Redirection fiche de la résidence'}
          id="accommodation-redirection"
          rows={2}
          {...register('external_url')}
        />
        {errors.external_url && <p className="fr-error-text fr-mt-1v">{errors.external_url.message}</p>}
      </div>
    </div>
  )
}
