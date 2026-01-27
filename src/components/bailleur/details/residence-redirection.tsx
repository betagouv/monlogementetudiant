'use client'

import { useFormContext } from 'react-hook-form'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'

export const ResidenceRedirection = ({ className }: { className?: string }) => {
  const {
    register,
    formState: { errors },
  } = useFormContext<TUpdateResidence>()
  return (
    <div className={className}>
      <div className="fr-px-2w fr-px-md-6w fr-pt-6w fr-pt-md-6w fr-pb-0">
        <div className="fr-flex fr-direction-column">
          <span className="fr-mb-0">
            URL de redirection <span className="fr-text-default--error">*</span>
          </span>
          <span className="fr-mb-0 fr-text--xs fr-text-mention--grey">URL de la page de résidence</span>
        </div>
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
