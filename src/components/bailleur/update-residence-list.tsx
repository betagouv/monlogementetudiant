'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { useRouter } from 'next/navigation'
import { FC } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { createToast } from '~/components/ui/createToast'
import { useUpdateAccommodation } from '~/hooks/use-update-accommodation'
import { TAccomodation } from '~/schemas/accommodations/accommodations'
import { TUpdateResidenceList, ZUpdateResidenceList } from '~/schemas/accommodations/update-residence-list'
import styles from './update-residence-list.module.css'

interface UpdateResidenceListProps {
  accommodation: TAccomodation
}

export const UpdateResidenceList: FC<UpdateResidenceListProps> = ({ accommodation }) => {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { mutate: updateAccommodation, isPending } = useUpdateAccommodation(accommodation.properties.slug)
  const form = useForm<TUpdateResidenceList>({
    defaultValues: {
      nb_t1_available: accommodation.properties.nb_t1_available ?? 0,
      nb_t1_bis_available: accommodation.properties.nb_t1_bis_available ?? 0,
      nb_t2_available: accommodation.properties.nb_t2_available ?? 0,
      nb_t3_available: accommodation.properties.nb_t3_available ?? 0,
      nb_t4_more_available: accommodation.properties.nb_t4_more_available ?? 0,
    },
    resolver: zodResolver(ZUpdateResidenceList),
  })

  const { formState, handleSubmit, register } = form

  const onSubmit = (data: TUpdateResidenceList) => {
    updateAccommodation(data, {
      onSuccess: () => {
        createToast({
          priority: 'success',
          message: 'Résidence mise à jour avec succès',
        })
        queryClient.invalidateQueries({ queryKey: ['my-accommodations'] })
        router.refresh()
      },
      onError: () => {
        createToast({
          priority: 'error',
          message: 'Erreur lors de la mise à jour de la résidence',
        })
      },
    })
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className={clsx(styles.container, 'fr-mt-4w')}>
          <div className={styles.inputGrid}>
            <div>
              <span className="fr-text--bold">Studio T1</span>
              <Input
                label="Logements disponibles"
                state={formState.errors.nb_t1_available ? 'error' : undefined}
                stateRelatedMessage={formState.errors.nb_t1_available?.message}
                nativeInputProps={{
                  ...register('nb_t1_available', { valueAsNumber: true }),
                  type: 'number',
                  min: 0,
                }}
              />
            </div>
            <div>
              <span className="fr-text--bold">Studio T1 Bis</span>
              <Input
                label="Logements disponibles"
                state={formState.errors.nb_t1_bis_available ? 'error' : undefined}
                stateRelatedMessage={formState.errors.nb_t1_bis_available?.message}
                nativeInputProps={{
                  ...register('nb_t1_bis_available', { valueAsNumber: true }),
                  type: 'number',
                  min: 0,
                }}
              />
            </div>
            <div>
              <span className="fr-text--bold">Studio T2</span>
              <Input
                label="Logements disponibles"
                state={formState.errors.nb_t2_available ? 'error' : undefined}
                stateRelatedMessage={formState.errors.nb_t2_available?.message}
                nativeInputProps={{
                  ...register('nb_t2_available', { valueAsNumber: true }),
                  type: 'number',
                  min: 0,
                }}
              />
            </div>
            <div>
              <span className="fr-text--bold">Logement T3</span>
              <Input
                label="Logements disponibles"
                state={formState.errors.nb_t3_available ? 'error' : undefined}
                stateRelatedMessage={formState.errors.nb_t3_available?.message}
                nativeInputProps={{
                  ...register('nb_t3_available', { valueAsNumber: true }),
                  type: 'number',
                  min: 0,
                }}
              />
            </div>
            <div>
              <span className="fr-text--bold">Logement T4+</span>
              <Input
                label="Logements disponibles"
                state={formState.errors.nb_t4_more_available ? 'error' : undefined}
                stateRelatedMessage={formState.errors.nb_t4_more_available?.message}
                nativeInputProps={{
                  ...register('nb_t4_more_available', { valueAsNumber: true }),
                  type: 'number',
                  min: 0,
                }}
              />
            </div>
          </div>

          <div className={styles.buttonContainer}>
            <Button type="submit" priority="secondary" iconId="ri-save-line" disabled={isPending}>
              Enregistrer
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  )
}
