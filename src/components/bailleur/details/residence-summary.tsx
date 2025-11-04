'use client'

import { useFormContext } from 'react-hook-form'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'

export const ResidenceSummary = () => {
  const { register } = useFormContext<TUpdateResidence>()
  return (
    <div className="fr-border-bottom">
      <div className="fr-p-6w">
        <h3>En quelques mots</h3>
        <span>Description</span>
        <textarea
          className={'fr-input fr-mt-2w'}
          aria-describedby={'Description de la résidence'}
          id="accommodation-description"
          rows={5}
          {...register('description')}
        />
      </div>
    </div>
  )
}
