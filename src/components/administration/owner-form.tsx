'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const ownerFormSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  url: z.string().url('URL invalide').or(z.literal('')).optional(),
})

export type OwnerFormData = z.infer<typeof ownerFormSchema>

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
    formState: { errors },
  } = useForm<OwnerFormData>({
    resolver: zodResolver(ownerFormSchema),
    defaultValues: {
      name: '',
      url: '',
      ...defaultValues,
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input
        label="Nom du bailleur"
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
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Enregistrement...' : submitLabel}
      </Button>
    </form>
  )
}
