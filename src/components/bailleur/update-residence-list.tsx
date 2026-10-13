'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import React, { FC, useMemo } from 'react'
import { FormProvider, useFieldArray, useForm } from 'react-hook-form'
import { useUpdateAccommodation } from '~/hooks/use-update-accommodation'
import { TAccomodation } from '~/schemas/accommodations/accommodations'
import { TYPOLOGIES, type TypologyType } from '~/schemas/accommodations/typology'
import { createUpdateResidenceListSchema, TUpdateResidenceList } from '~/schemas/accommodations/update-residence-list'
import styles from './update-residence-list.module.css'

interface UpdateResidenceListProps {
  accommodation: TAccomodation
  children: React.ReactNode
}

export const UpdateResidenceList: FC<UpdateResidenceListProps> = ({ accommodation, children }) => {
  const t = useTranslations('bailleur.residences.list')
  const tSchemas = useTranslations('schemas')
  const { mutateAsync: updateAccommodation, isPending } = useUpdateAccommodation(accommodation.slug)
  const { typologies } = accommodation

  // Only typologies that have stock are editable.
  const editableTypes = TYPOLOGIES.filter(({ type }) => ((typologies[type]?.nbTotal ?? 0) as number) > 0).map(({ type }) => type)
  const schema = useMemo(() => {
    const existingTotals = Object.fromEntries(TYPOLOGIES.map(({ type }) => [type, typologies[type]?.nbTotal ?? null])) as Partial<
      Record<TypologyType, number | null>
    >
    return createUpdateResidenceListSchema(existingTotals, tSchemas)
  }, [typologies, tSchemas])

  const form = useForm<TUpdateResidenceList>({
    defaultValues: {
      availability: editableTypes.map((type) => ({ type, nbAvailable: typologies[type]?.nbAvailable ?? null })),
    },
    resolver: zodResolver(schema),
  })

  const { formState, handleSubmit, register, control } = form

  const { fields } = useFieldArray({ control, name: 'availability' })

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
                {fields.map((field, index) => {
                  const stock = typologies[field.type]?.nbTotal ?? 0
                  return (
                    <div key={field.id}>
                      <div className="fr-flex fr-justify-content-space-between">
                        <span className="fr-text--bold">{tSchemas(`typologies.${field.type}`)}</span>
                        <span className="fr-text--xs fr-mb-0">{t('housingCount', { count: stock })}</span>
                      </div>
                      <Input
                        label={t('availableLabel')}
                        state={formState.errors.availability?.[index]?.nbAvailable ? 'error' : undefined}
                        stateRelatedMessage={formState.errors.availability?.[index]?.nbAvailable?.message}
                        nativeInputProps={{
                          ...register(`availability.${index}.nbAvailable`, { valueAsNumber: true }),
                          type: 'number',
                          min: 0,
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            <div className={styles.buttonContainer}>
              <Button size="small" type="submit" priority="secondary" iconId="ri-save-line" disabled={isPending}>
                {t('save')}
              </Button>
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  )
}
