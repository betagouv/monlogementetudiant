'use client'

import { TAccomodationDetails } from '~/schemas/accommodations/accommodations'

export const ResidenceSummary = ({ accommodation }: { accommodation: TAccomodationDetails }) => {
  return (
    <div className="fr-border-bottom">
      <div className="fr-p-6w">
        <h3>En quelques mots</h3>
        <span>Description</span>
        <textarea
          className={'fr-input fr-mt-2w'}
          aria-describedby={'Description de la résidence'}
          id="accommodation-description"
          // onBlur={onBlur}
          onChange={console.log}
          value={accommodation.description ?? ''}
          rows={5}
        />
      </div>
    </div>
  )
}
