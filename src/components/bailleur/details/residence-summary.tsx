'use client'

import Input from '@codegouvfr/react-dsfr/Input'
import { Controller, useFormContext } from 'react-hook-form'
import { RichTextEditor } from '~/components/ui/rich-text-editor'
import { TCreateResidence } from '~/schemas/accommodations/create-residence'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'

export const ResidenceSummary = () => {
  const { control, register } = useFormContext<TUpdateResidence | TCreateResidence>()
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

        <Input
          className="fr-mt-4w"
          label="Détails de la redevance locative"
          hintText={
            <>
              <span className="fr-mb-0">Indiquez ce que comprennent les charges locatives.</span>
              <br />
              <span className="fr-mb-0 fr-text--xs fr-text-mention--grey">
                Exemple : chauffage collectif, wifi, entretien des parties communes, salle de sport, etc.
              </span>
            </>
          }
          textArea
          nativeTextAreaProps={{ rows: 2, ...register('rental_charges_details') }}
        />
      </div>
    </div>
  )
}
