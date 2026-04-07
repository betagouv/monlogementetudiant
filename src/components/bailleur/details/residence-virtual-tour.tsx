'use client'

import { useFormContext } from 'react-hook-form'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'

export const ResidenceVirtualTour = () => {
  const { register } = useFormContext<TUpdateResidence>()
  return (
    <div className="fr-border-bottom">
      <div className="fr-p-2w fr-p-md-6w">
        <h3>Visite virtuelle</h3>
        <div className="fr-flex fr-direction-column">
          <span className="fr-mb-0">Code d&apos;intégration de la visite virtuelle</span>
          <span className="fr-mb-0 fr-text--xs fr-text-mention--grey">
            Collez un code d&apos;intégration iframe, un lien vers une vidéo (.mp4, .webm, .ogg, .mov), ou un lien vers une visite 3D (ex:
            Giraffe360)
          </span>
        </div>
        <textarea className="fr-input fr-mt-2w" id="accommodation-virtual-tour" rows={6} {...register('virtual_tour_url')} />
      </div>
    </div>
  )
}
