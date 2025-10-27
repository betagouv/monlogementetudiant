'use client'
import { TAccomodationDetails } from '~/schemas/accommodations/accommodations'

export const ResidenceRedirection = ({ accommodation }: { accommodation: TAccomodationDetails }) => {
  return (
    <div className="fr-border-top">
      <div className="fr-p-6w">
        <span className="fr-pb-2w">
          URL de redirection <span className="fr-text-default--error">*</span>
        </span>
        <textarea
          className="fr-input fr-mt-2w"
          aria-describedby={'Redirection fiche de la résidence'}
          id="accommodation-redirection"
          // onBlur={onBlur}
          onChange={console.log}
          value={accommodation.external_url ?? ''}
          rows={2}
        />
      </div>
    </div>
  )
}
