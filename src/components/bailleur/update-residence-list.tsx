'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { zodResolver } from '@hookform/resolvers/zod'
import React, { FC } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useUpdateAccommodation } from '~/hooks/use-update-accommodation'
import { TAccomodation } from '~/schemas/accommodations/accommodations'
import { TUpdateResidenceList, createUpdateResidenceListSchema } from '~/schemas/accommodations/update-residence-list'
import styles from './update-residence-list.module.css'

interface UpdateResidenceListProps {
  accommodation: TAccomodation
  children: React.ReactNode
}

export const UpdateResidenceList: FC<UpdateResidenceListProps> = ({ accommodation, children }) => {
  const { mutateAsync: updateAccommodation, isPending } = useUpdateAccommodation(accommodation.properties.slug)
  const form = useForm<TUpdateResidenceList>({
    defaultValues: {
      nb_t1_available: accommodation.properties.nb_t1_available ?? 0,
      nb_t1_bis_available: accommodation.properties.nb_t1_bis_available ?? 0,
      nb_t2_available: accommodation.properties.nb_t2_available ?? 0,
      nb_t3_available: accommodation.properties.nb_t3_available ?? 0,
      nb_t4_more_available: accommodation.properties.nb_t4_more_available ?? 0,
    },
    resolver: zodResolver(
      createUpdateResidenceListSchema({
        nb_t1: accommodation.properties.nb_t1,
        nb_t1_bis: accommodation.properties.nb_t1_bis,
        nb_t2: accommodation.properties.nb_t2,
        nb_t3: accommodation.properties.nb_t3,
        nb_t4_more: accommodation.properties.nb_t4_more,
      }),
    ),
  })

  const { formState, handleSubmit, register } = form

  const onSubmit = async (data: TUpdateResidenceList) => {
    await updateAccommodation(data)
  }

  return (
    <div className="fr-width-full fr-p-4w fr-border-top fr-border-right fr-border-bottom" style={{ background: 'white' }}>
      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="fr-height-full">
          <div className="fr-flex fr-direction-column fr-flex-gap-6v fr-justify-content-space-between fr-height-full">
            <div className="fr-flex fr-direction-column fr-flex-gap-4v">
              {children}
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
            </div>

            <div className={styles.buttonContainer}>
              <Button size="small" type="submit" priority="secondary" iconId="ri-save-line" disabled={isPending}>
                Enregistrer
              </Button>
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  )
}
