'use client'

import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox'
import { Input } from '@codegouvfr/react-dsfr/Input'
import { Money } from '@codegouvfr/react-dsfr/picto'
import Avatar from '@codegouvfr/react-dsfr/picto/Avatar'
import Backpack from '@codegouvfr/react-dsfr/picto/Backpack'
import Ecosystem from '@codegouvfr/react-dsfr/picto/Ecosystem'
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons'
import { FC, useEffect } from 'react'
import { useFormContext } from 'react-hook-form'
import { type HelpSimulatorFormData } from '~/components/helps-simulator/help-simulator-schema'
import { RequiredLabel } from '~/components/helps-simulator/required-label'

export const HelpSimulatorStep1: FC = () => {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<HelpSimulatorFormData>()

  const status = watch('status')
  const currentYear = watch('currentYear')

  // Réinitialiser currentYear et les champs dépendants quand le statut change
  useEffect(() => {
    setValue('currentYear', undefined)
    setValue('isProfessionalLicence', undefined)
    setValue('scholarship', undefined)
    setValue('changingRegion', undefined)
  }, [status, setValue])

  const showTerminaleCheckbox = status === 'lyceen'
  const showLicence3Checkbox = status !== 'lyceen'
  const isMobilityCandidate = currentYear === 'terminale' || currentYear === 'licence3'

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
          type: 'number',
          min: 16,
          max: 99,
        }}
      />

      <RadioButtons
        legend={<RequiredLabel>Quel est votre statut ?</RequiredLabel>}
        name="status"
        state={errors.status ? 'error' : undefined}
        stateRelatedMessage={errors.status?.message}
        className="fr-mb-0"
        classes={{
          content: 'fr-flex fr-flex-gap-4v fr-align-items-center fr-flex-wrap',
          inputGroup: 'fr-mb-0 fr-mt-0',
        }}
        options={[
          {
            illustration: <Avatar width={56} height={56} />,
            label: 'Lycéen',
            nativeInputProps: {
              ...register('status'),
              value: 'lyceen',
            },
          },
          {
            illustration: <Backpack width={56} height={56} />,
            label: 'Étudiant',
            nativeInputProps: {
              ...register('status'),
              value: 'student',
            },
          },
          {
            illustration: <Money width={56} height={56} />,
            label: 'Étudiant salarié',
            nativeInputProps: {
              ...register('status'),
              value: 'employed-student',
            },
          },
          {
            illustration: <Ecosystem width={56} height={56} />,
            label: 'Apprenti / Alternant',
            nativeInputProps: {
              ...register('status'),
              value: 'apprentice',
            },
          },
        ]}
      />

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
              nativeInputProps: { ...register('isProfessionalLicence'), value: 'yes' },
            },
            {
              label: 'Non',
              nativeInputProps: { ...register('isProfessionalLicence'), value: 'no' },
            },
            {
              label: 'Je ne sais pas',
              nativeInputProps: { ...register('isProfessionalLicence'), value: 'unknown' },
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
                : "L'année prochaine, allez-vous étudier dans une région différente de votre lieu de résidence actuel ?"}
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
              nativeInputProps: { ...register('changingRegion'), value: 'yes' },
            },
            {
              label: 'Non',
              nativeInputProps: { ...register('changingRegion'), value: 'no' },
            },
            {
              label: 'Je ne sais pas',
              nativeInputProps: { ...register('changingRegion'), value: 'unknown' },
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
          options={[
            {
              label: 'Oui, bourse de lycée',
              nativeInputProps: { ...register('scholarship'), value: 'bourse-lycee' },
            },
            {
              label: 'Oui, bourse du CROUS',
              nativeInputProps: { ...register('scholarship'), value: 'bourse-crous' },
            },
            {
              label: 'Oui, allocation spécifique annuelle pour étudiant en difficulté',
              nativeInputProps: { ...register('scholarship'), value: 'allocation-speciale' },
            },
            {
              label: 'Non',
              nativeInputProps: { ...register('scholarship'), value: 'non' },
            },
          ]}
        />
      )}
    </>
  )
}
