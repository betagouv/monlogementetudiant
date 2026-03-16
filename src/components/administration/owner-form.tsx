'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import ToggleSwitch from '@codegouvfr/react-dsfr/ToggleSwitch'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { type OwnerFormData, ownerFormSchema } from '~/schemas/owner-form'

interface OwnerFormProps {
  defaultValues?: Partial<OwnerFormData>
  onSubmit: (data: OwnerFormData) => void
  isPending?: boolean
  submitLabel?: string
}

export const OwnerForm = ({ defaultValues, onSubmit, isPending, submitLabel = 'Enregistrer' }: OwnerFormProps) => {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OwnerFormData>({
    resolver: zodResolver(ownerFormSchema),
    defaultValues: {
      name: '',
      url: '',
      acceptDossierFacileApplications: false,
      ...defaultValues,
    },
  })

  const acceptDf = watch('acceptDossierFacileApplications')

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input
        label="Nom du gestionnaire"
        nativeInputProps={register('name')}
        state={errors.name ? 'error' : 'default'}
        stateRelatedMessage={errors.name?.message}
      />
      <Input
        label="Site web (optionnel)"
        nativeInputProps={{ type: 'url', ...register('url') }}
        state={errors.url ? 'error' : 'default'}
        stateRelatedMessage={errors.url?.message}
      />
      <ToggleSwitch
        label="Accepter les candidatures DossierFacile"
        checked={acceptDf}
        onChange={(checked) => {
          setValue('acceptDossierFacileApplications', checked)
        }}
        inputTitle="Activer ou désactiver les candidatures DossierFacile"
      />
      <Button type="submit" disabled={isPending} className="fr-mt-2w">
        {isPending ? 'Enregistrement...' : submitLabel}
      </Button>
    </form>
  )
}
