'use client'

import { Button } from '@codegouvfr/react-dsfr/Button'
import { Input } from '@codegouvfr/react-dsfr/Input'
import { Select } from '@codegouvfr/react-dsfr/Select'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { RentSearchModal } from '~/components/ui/rent-search-modal'
import { EXPENSE_RANGES, ExpenseType, useBudgetSimulator } from './budget-simulator-context'
import styles from './forms.module.css'

export function ExpenseForm() {
  const { state, updateMonthlyExpenses, addExpenseType, removeExpenseType } = useBudgetSimulator()
  const t = useTranslations('budgetSimulator.expenses')

  const handleExpenseChange = (type: ExpenseType, value: number) => {
    updateMonthlyExpenses({ [type]: value })
  }

  const expenseTypes = [
    'housing',
    'housingCharges',
    'food',
    'dailyLife',
    'communication',
    'transport',
    'registrationFees',
    'cvec',
    'studyMaterials',
    'mutuelle',
    'otherHealthcare',
    'enjoyment',
    'childcare',
    'other',
  ] as ExpenseType[]

  const handleAddExpenseType = () => {
    // Find first unused expense type
    const unusedType = expenseTypes.find((type) => !state.activeExpenseTypes.includes(type))
    if (unusedType) {
      addExpenseType(unusedType)
    }
  }

  const handleRemoveExpenseType = (type: ExpenseType) => removeExpenseType(type)

  const canAddMore = state.activeExpenseTypes.length < expenseTypes.length

  return (
    <div className="fr-flex fr-direction-column fr-flex-gap-4v">
      {state.activeExpenseTypes.map((type, index) => {
        return (
          <div key={type} className="fr-flex fr-flex-gap-4v">
            <div className={clsx('fr-flex-basis-0 fr-flex-grow-1', styles.sourceSelect)}>
              <Select
                className={styles.select}
                label={t('categoryLabel')}
                nativeSelectProps={{
                  value: type,
                  onChange: (e) => {
                    // Remove old type and add new one
                    const oldAmount = state.monthlyExpenses[type]
                    removeExpenseType(type)
                    addExpenseType(e.target.value as ExpenseType)
                    updateMonthlyExpenses({ [e.target.value as ExpenseType]: oldAmount })
                  },
                }}
              >
                {expenseTypes
                  .filter((expenseType) => expenseType === type || !state.activeExpenseTypes.includes(expenseType))
                  .map((expenseType) => (
                    <option key={expenseType} value={expenseType}>
                      {t(`types.${expenseType}`)}
                    </option>
                  ))}
              </Select>
            </div>
            <div className={clsx('fr-flex-basis-0 fr-flex-grow-1', styles.amountInput)}>
              <div className="fr-flex fr-direction-column">
                <Input
                  className="fr-mb-1w"
                  label={t('amountLabel')}
                  nativeInputProps={{
                    type: 'number',
                    min: 0,
                    value: state.monthlyExpenses[type] === 0 ? '' : state.monthlyExpenses[type],
                    onChange: (e) => handleExpenseChange(type, Number(e.target.value) || 0),
                  }}
                  iconId="ri-money-euro-circle-line"
                />

                {EXPENSE_RANGES[type as keyof typeof EXPENSE_RANGES] && (
                  <span className="fr-text--xs fr-mb-0">
                    {t('amountHint', {
                      low: EXPENSE_RANGES[type as keyof typeof EXPENSE_RANGES].lowRange,
                      high: EXPENSE_RANGES[type as keyof typeof EXPENSE_RANGES].highRange,
                    })}
                  </span>
                )}
                {type === 'housing' && (
                  <RentSearchModal
                    onApply={(selectedCity) => {
                      handleExpenseChange('housing', Math.round(selectedCity.rentFor20M2))
                    }}
                  />
                )}
              </div>
            </div>
            <div
              className={clsx(
                'fr-flex fr-flex-gap-2v',
                type === 'housing'
                  ? 'fr-align-items-center fr-mb-1w'
                  : EXPENSE_RANGES[type as keyof typeof EXPENSE_RANGES]
                    ? 'fr-align-items-center fr-mt-1w'
                    : 'fr-align-items-end fr-mb-1w',
              )}
            >
              {index === state.activeExpenseTypes.length - 1 && canAddMore ? (
                <Button
                  iconId="ri-add-line"
                  title={t('addExpenseTitle')}
                  priority="secondary"
                  size="small"
                  onClick={handleAddExpenseType}
                />
              ) : (
                state.activeExpenseTypes.length > 1 && (
                  <Button
                    priority="tertiary"
                    title={t('removeExpenseTitle')}
                    iconId="ri-delete-bin-line"
                    size="small"
                    onClick={() => handleRemoveExpenseType(type)}
                  />
                )
              )}
            </div>
          </div>
        )
      })}
      {state.activeExpenseTypes.some((type) => EXPENSE_RANGES[type as keyof typeof EXPENSE_RANGES]) && (
        <div>
          <hr className="fr-pt-2w fr-pb-0 fr-mt-2w" />
          <span className="fr-text--xs fr-mb-0 fr-text-mention--grey">
            * Ces informations sont issues des données déclarées par les étudiants dans le cadre de l’enquête{' '}
            <Link
              className="fr-link fr-text--xs"
              href="https://www.ove-national.education.fr/wp-content/uploads/2024/03/OVE-BROCHURE-REPERES-CDV2023-1-1.pdf"
              target="_blank"
            >
              Repère 2023 de OVE
            </Link>{' '}
            et retravaillées en fonction des profils “décohabitants” (n’habitant pas chez leurs parents) et “indépendants” (n'étant pas ou
            peu aidés par leurs parents) des étudiants afin de donner des estimations de budget.
          </span>
        </div>
      )}
    </div>
  )
}
