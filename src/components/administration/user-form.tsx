'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import Select from '@codegouvfr/react-dsfr/Select'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const userFormSchema = z.object({
  email: z.string().email('Email invalide'),
  firstname: z.string().min(1, 'Le prenom est requis'),
  lastname: z.string().min(1, 'Le nom est requis'),
  role: z.enum(['admin', 'owner', 'user']),
})

export type UserFormData = z.infer<typeof userFormSchema>

interface UserFormProps {
  defaultValues?: Partial<UserFormData>
  onSubmit: (data: UserFormData) => void
  isPending?: boolean
  submitLabel?: string
}

export const UserForm = ({ defaultValues, onSubmit, isPending, submitLabel = 'Enregistrer' }: UserFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: '',
      firstname: '',
      lastname: '',
      role: 'user',
      ...defaultValues,
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input
        label="Email"
        nativeInputProps={{ type: 'email', ...register('email') }}
        state={errors.email ? 'error' : 'default'}
        stateRelatedMessage={errors.email?.message}
      />
      <Input
        label="Prenom"
        nativeInputProps={register('firstname')}
        state={errors.firstname ? 'error' : 'default'}
        stateRelatedMessage={errors.firstname?.message}
      />
      <Input
        label="Nom"
        nativeInputProps={register('lastname')}
        state={errors.lastname ? 'error' : 'default'}
        stateRelatedMessage={errors.lastname?.message}
      />
      <Select
        label="Role"
        nativeSelectProps={register('role')}
        state={errors.role ? 'error' : 'default'}
        stateRelatedMessage={errors.role?.message}
      >
        <option value="user">Etudiant</option>
        <option value="owner">Bailleur</option>
        <option value="admin">Administrateur</option>
      </Select>
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Enregistrement...' : submitLabel}
      </Button>
    </form>
  )
}
