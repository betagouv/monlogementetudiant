'use client'

import { Controller, useFormContext } from 'react-hook-form'
import { RichTextEditor } from '~/components/ui/rich-text-editor'
import { TCreateResidence } from '~/schemas/accommodations/create-residence'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'

export const ResidenceSummary = () => {
  const { control } = useFormContext<TUpdateResidence | TCreateResidence>()
  return (
    <div className="fr-border-bottom">
      <div className="fr-p-2w fr-p-md-6w">
        <h3>En quelques mots</h3>
        <span>Description</span>
        <div className="fr-mt-2w">
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <RichTextEditor value={field.value || ''} onChange={field.onChange} placeholder="Décrivez votre résidence..." />
            )}
          />
        </div>
      </div>
    </div>
  )
}
