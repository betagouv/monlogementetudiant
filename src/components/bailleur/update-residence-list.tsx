'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { zodResolver } from '@hookform/resolvers/zod'
import React, { FC } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useUpdateAccommodation } from '~/hooks/use-update-accommodation'
import { TAccomodation } from '~/schemas/accommodations/accommodations'
import { createUpdateResidenceListSchema, TUpdateResidenceList } from '~/schemas/accommodations/update-residence-list'
import { sPluriel } from '~/utils/sPluriel'
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
      nb_t4_available: accommodation.properties.nb_t4_available ?? 0,
      nb_t5_available: accommodation.properties.nb_t5_available ?? 0,
      nb_t6_available: accommodation.properties.nb_t6_available ?? 0,
      nb_t7_more_available: accommodation.properties.nb_t7_more_available ?? 0,
    },
    resolver: zodResolver(
      createUpdateResidenceListSchema({
        nb_t1: accommodation.properties.nb_t1,
        nb_t1_bis: accommodation.properties.nb_t1_bis,
        nb_t2: accommodation.properties.nb_t2,
        nb_t3: accommodation.properties.nb_t3,
        nb_t4: accommodation.properties.nb_t4,
        nb_t5: accommodation.properties.nb_t5,
        nb_t6: accommodation.properties.nb_t6,
        nb_t7_more: accommodation.properties.nb_t7_more,
      }),
    ),
  })

  const { formState, handleSubmit, register } = form

  const onSubmit = async (data: TUpdateResidenceList) => {
    await updateAccommodation(data)
  }

  return (
    <div className="fr-width-full fr-p-4w fr-border-top fr-border-right fr-border-bottom fr-background-default--grey">
      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="fr-height-full">
          <div className="fr-flex fr-direction-column fr-flex-gap-6v fr-justify-content-space-between fr-height-full">
            <div className="fr-flex fr-direction-column">
              {children}
              <div className={styles.inputGrid}>
                {[
                  { key: 'nb_t1_available', stock: accommodation.properties.nb_t1, label: 'Studio T1' },
                  { key: 'nb_t1_bis_available', stock: accommodation.properties.nb_t1_bis, label: 'Studio T1 Bis' },
                  { key: 'nb_t2_available', stock: accommodation.properties.nb_t2, label: 'Studio T2' },
                  { key: 'nb_t3_available', stock: accommodation.properties.nb_t3, label: 'Logement T3' },
                  { key: 'nb_t4_available', stock: accommodation.properties.nb_t4, label: 'Logement T4' },
                  { key: 'nb_t5_available', stock: accommodation.properties.nb_t5, label: 'Logement T5' },
                  { key: 'nb_t6_available', stock: accommodation.properties.nb_t6, label: 'Logement T6' },
                  { key: 'nb_t7_more_available', stock: accommodation.properties.nb_t7_more, label: 'Logement T7+' },
                ]
                  .filter(({ stock }) => !!stock && stock > 0)
                  .map(({ key, label, stock }) => (
                    <div key={key}>
                      <div className="fr-flex fr-justify-content-space-between">
                        <span className="fr-text--bold">{label}</span>
                        <span className="fr-text--xs fr-mb-0">
                          {stock} logement{sPluriel(stock ?? 0)}
                        </span>
                      </div>
                      <Input
                        label="Disponibles"
                        state={formState.errors[key as keyof typeof formState.errors] ? 'error' : undefined}
                        stateRelatedMessage={formState.errors[key as keyof typeof formState.errors]?.message}
                        nativeInputProps={{
                          ...register(key as keyof TUpdateResidenceList, { valueAsNumber: true }),
                          type: 'number',
                          min: 0,
                        }}
                      />
                    </div>
                  ))}
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
