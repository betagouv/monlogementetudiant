'use client'

import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox'
import { Input } from '@codegouvfr/react-dsfr/Input'
import { Money } from '@codegouvfr/react-dsfr/picto'
import Avatar from '@codegouvfr/react-dsfr/picto/Avatar'
import Backpack from '@codegouvfr/react-dsfr/picto/Backpack'
import Ecosystem from '@codegouvfr/react-dsfr/picto/Ecosystem'
import School from '@codegouvfr/react-dsfr/picto/School'
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons'
import clsx from 'clsx'
import { FC, ReactNode, useEffect } from 'react'
import { useFormContext } from 'react-hook-form'
import { type HelpSimulatorFormData } from '~/components/helps-simulator/help-simulator-schema'
import { RequiredLabel } from '~/components/ui/required-mark'
import styles from './help-simulator-step-1.module.css'

type Status = HelpSimulatorFormData['status'][number]

const STATUS_OPTIONS: { value: Status; label: string; illustration: ReactNode }[] = [
  { value: 'lyceen', label: 'Lycéen', illustration: <Avatar width={56} height={56} /> },
  { value: 'student', label: 'Étudiant', illustration: <Backpack width={56} height={56} /> },
  { value: 'employed-student', label: 'Étudiant salarié', illustration: <Money width={56} height={56} /> },
  { value: 'apprentice', label: 'Apprenti / Alternant', illustration: <Ecosystem width={56} height={56} /> },
  { value: 'boursier-crous', label: 'Étudiant boursier du Crous', illustration: <School width={56} height={56} /> },
]

export const HelpSimulatorStep1: FC = () => {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<HelpSimulatorFormData>()

  const status = watch('status') ?? []
  const currentYear = watch('currentYear')
  const isInternationalStudent = watch('isInternationalStudent') ?? false

  const isLyceen = status.includes('lyceen')

  // Réinitialiser currentYear et les champs dépendants quand le statut change
  useEffect(() => {
    setValue('currentYear', undefined)
    setValue('isProfessionalLicence', undefined)
    setValue('scholarship', undefined)
    setValue('changingRegion', undefined)
  }, [status.join(','), setValue])

  const showTerminaleCheckbox = isLyceen

  const scholarshipOptions = isLyceen
    ? [
        { label: 'Oui, bourse de lycée', value: 'bourse-lycee' as const },
        { label: 'Non', value: 'non' as const },
      ]
    : [
        { label: 'Oui, bourse du CROUS', value: 'bourse-crous' as const },
        { label: 'Oui, allocation spécifique annuelle pour étudiant en difficulté', value: 'allocation-speciale' as const },
        { label: 'Non', value: 'non' as const },
      ]
  const showLicence3Checkbox = status.length > 0 && !isLyceen
  const isMobilityCandidate = currentYear === 'terminale' || currentYear === 'licence3'

  // Le statut est multi-sélectionnable, mais « Lycéen » reste exclusif des statuts étudiants.
  const handleStatusChange = (value: Status, checked: boolean) => {
    let next: Status[]
    if (value === 'lyceen') {
      next = checked ? ['lyceen'] : []
    } else {
      const withoutLyceen = status.filter((s) => s !== 'lyceen')
      next = checked ? [...withoutLyceen, value] : withoutLyceen.filter((s) => s !== value)
    }
    setValue('status', next, { shouldValidate: !!errors.status })
    // La question « étudiant international » ne concerne pas les lycéens
    if (next.length === 0 || next.includes('lyceen')) {
      setValue('isInternationalStudent', false)
    }
  }

  const handleCurrentYearChange = (year: 'terminale' | 'licence3', checked: boolean) => {
    setValue('currentYear', checked ? year : undefined)
    if (!checked) {
      setValue('isProfessionalLicence', undefined)
      setValue('scholarship', undefined)
      setValue('changingRegion', undefined)
    }
  }

  return (
    <>
      <Input
        label={<RequiredLabel>Quel âge avez-vous ?</RequiredLabel>}
        state={errors.age ? 'error' : undefined}
        stateRelatedMessage={errors.age?.message}
        nativeInputProps={{
          ...register('age', { valueAsNumber: true }),
          'aria-required': true,
          type: 'number',
          min: 16,
          max: 99,
        }}
      />

      <fieldset
        className={styles.fieldset}
        aria-required="true"
        aria-describedby={errors.status ? 'status-error' : undefined}
        aria-invalid={errors.status ? true : undefined}
      >
        <legend className={styles.legend}>
          <RequiredLabel>Quel est votre statut ? (plusieurs choix possibles)</RequiredLabel>
        </legend>
        <div className={clsx(styles.grid, errors.status && styles.gridError)}>
          {STATUS_OPTIONS.map(({ value, label, illustration }) => {
            const checked = status.includes(value)
            return (
              <label key={value} className={clsx(styles.option, checked && styles.optionChecked)}>
                <input
                  type="checkbox"
                  name="status"
                  value={value}
                  checked={checked}
                  onChange={(e) => handleStatusChange(value, e.target.checked)}
                  className={styles.input}
                />
                <span className={styles.indicator} aria-hidden="true" />
                <span className={styles.body}>{label}</span>
                <span className={styles.pictogram} aria-hidden="true">
                  {illustration}
                </span>
              </label>
            )
          })}
        </div>
        {errors.status && (
          <p className="fr-error-text fr-mt-1w" id="status-error" role="alert">
            {errors.status.message as string}
          </p>
        )}
      </fieldset>

      {showTerminaleCheckbox && (
        <Checkbox
          className="fr-mt-2w fr-mb-2w"
          options={[
            {
              label: 'Je suis actuellement en terminale',
              nativeInputProps: {
                checked: currentYear === 'terminale',
                onChange: (e) => handleCurrentYearChange('terminale', e.target.checked),
              },
            },
          ]}
        />
      )}

      {showLicence3Checkbox && (
        <Checkbox
          className="fr-mt-2w fr-mb-2w"
          options={[
            {
              label: 'Je suis actuellement en 3ème année de licence',
              nativeInputProps: {
                checked: currentYear === 'licence3',
                onChange: (e) => handleCurrentYearChange('licence3', e.target.checked),
              },
            },
            {
              label: 'Je suis étudiant international extra-communautaire',
              nativeInputProps: {
                checked: isInternationalStudent,
                onChange: (e) => setValue('isInternationalStudent', e.target.checked),
              },
            },
          ]}
        />
      )}

      {isMobilityCandidate && currentYear === 'licence3' && (
        <RadioButtons
          legend={<RequiredLabel>Votre licence est-elle une licence professionnelle ?</RequiredLabel>}
          name="isProfessionalLicence"
          state={errors.isProfessionalLicence ? 'error' : undefined}
          stateRelatedMessage={errors.isProfessionalLicence?.message}
          className="fr-mb-0"
          classes={{
            content: 'fr-flex fr-flex-gap-4v fr-align-items-center fr-flex-wrap',
            inputGroup: 'fr-mb-0 fr-mt-0',
          }}
          options={[
            {
              label: 'Oui',
              nativeInputProps: { ...register('isProfessionalLicence'), value: 'yes', 'aria-required': true },
            },
            {
              label: 'Non',
              nativeInputProps: { ...register('isProfessionalLicence'), value: 'no', 'aria-required': true },
            },
            {
              label: 'Je ne sais pas',
              nativeInputProps: { ...register('isProfessionalLicence'), value: 'unknown', 'aria-required': true },
            },
          ]}
        />
      )}

      {isMobilityCandidate && (
        <RadioButtons
          legend={
            <RequiredLabel>
              {currentYear === 'terminale'
                ? "L'année prochaine, allez-vous étudier dans une zone différente de votre lieu de résidence actuel ?"
                : "L'année prochaine, allez-vous entrer en Master 1 dans une région différente de votre lieu de résidence actuel ?"}
            </RequiredLabel>
          }
          name="changingRegion"
          state={errors.changingRegion ? 'error' : undefined}
          stateRelatedMessage={errors.changingRegion?.message}
          className="fr-mb-0"
          classes={{
            content: 'fr-flex fr-flex-gap-4v fr-align-items-center fr-flex-wrap',
            inputGroup: 'fr-mb-0 fr-mt-0',
          }}
          options={[
            {
              label: currentYear === 'terminale' ? "Oui, je change de région ou d'académie" : 'Oui, je change de région',
              nativeInputProps: { ...register('changingRegion'), value: 'yes', 'aria-required': true },
            },
            {
              label: 'Non',
              nativeInputProps: { ...register('changingRegion'), value: 'no', 'aria-required': true },
            },
            {
              label: 'Je ne sais pas',
              nativeInputProps: { ...register('changingRegion'), value: 'unknown', 'aria-required': true },
            },
          ]}
        />
      )}

      {isMobilityCandidate && (
        <RadioButtons
          legend={<RequiredLabel>Êtes-vous boursier ?</RequiredLabel>}
          name="scholarship"
          state={errors.scholarship ? 'error' : undefined}
          stateRelatedMessage={errors.scholarship?.message}
          className="fr-mb-0"
          options={scholarshipOptions.map(({ label, value }) => ({
            label,
            nativeInputProps: { ...register('scholarship'), value, 'aria-required': true },
          }))}
        />
      )}
    </>
  )
}
