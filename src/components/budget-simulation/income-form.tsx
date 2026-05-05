'use client'

import { Button } from '@codegouvfr/react-dsfr/Button'
import { Input } from '@codegouvfr/react-dsfr/Input'
import { Select } from '@codegouvfr/react-dsfr/Select'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { DEFAULT_INCOME_FREQUENCIES, type IncomeType, useBudgetSimulator } from './budget-simulator-context'
import styles from './forms.module.css'

export function IncomeForm() {
  const { state, updateMonthlyIncomes, updateIncomeFrequencies, addIncomeType, removeIncomeType } = useBudgetSimulator()
  const t = useTranslations('budgetSimulator.income')

  const incomeTypes: IncomeType[] = [
    'familyAid',
    'scholarships',
    'cafHousingAid',
    'otherPublicAid',
    'salary',
    'studentLoan',
    'other',
    'savings',
  ]

  const handleIncomeChange = (type: IncomeType, value: number) => {
    updateMonthlyIncomes({ [type]: value })
  }

  const handleAddIncomeType = () => {
    // Find first unused income type
    const unusedType = incomeTypes.find((type) => !state.activeIncomeTypes.includes(type))
    if (unusedType) {
      addIncomeType(unusedType)
    }
  }

  const handleRemoveIncomeType = (type: IncomeType) => {
    removeIncomeType(type)
  }

  const canAddMore = state.activeIncomeTypes.length < incomeTypes.length

  return (
    <div className="fr-flex fr-direction-column fr-flex-gap-4v">
      {state.activeIncomeTypes.map((type) => (
        <div key={type} className={clsx('fr-flex fr-align-items-end fr-flex-gap-4v', styles.formRow)}>
          <div className={clsx('fr-flex-basis-0 fr-flex-grow-1', styles.sourceSelect)}>
            <Select
              label={t('sourceLabel')}
              nativeSelectProps={{
                value: type,
                onChange: (e) => {
                  const oldAmount = state.monthlyIncomes[type]
                  removeIncomeType(type)
                  addIncomeType(e.target.value as IncomeType)
                  updateMonthlyIncomes({ [e.target.value as IncomeType]: oldAmount })
                  updateIncomeFrequencies({ [e.target.value as IncomeType]: DEFAULT_INCOME_FREQUENCIES[e.target.value as IncomeType] })
                },
              }}
            >
              {incomeTypes
                .filter((incomeType) => incomeType === type || !state.activeIncomeTypes.includes(incomeType))
                .map((incomeType) => (
                  <option key={incomeType} value={incomeType}>
                    {t(`types.${incomeType}`)}
                  </option>
                ))}
            </Select>
          </div>
          <div className={clsx('fr-flex-basis-0 fr-flex-grow-1', styles.frequencySelect)}>
            <Select
              label={t('frequencyLabel')}
              nativeSelectProps={{
                value: state.incomeFrequencies[type],
                onChange: (e) => updateIncomeFrequencies({ [type]: e.target.value as 'monthly' | 'yearly' }),
              }}
            >
              <option value="monthly">{t('frequencies.monthly')}</option>
              <option value="yearly">{t('frequencies.yearly')}</option>
            </Select>
          </div>
          <div className={clsx('fr-flex-basis-0 fr-flex-grow-1', styles.amountInput)}>
            <Input
              label={t('amountLabel')}
              nativeInputProps={{
                type: 'number',
                min: 0,
                value: state.monthlyIncomes[type] === 0 ? '' : state.monthlyIncomes[type],
                onChange: (e) => handleIncomeChange(type, Number(e.target.value) || 0),
              }}
              iconId="ri-money-euro-circle-line"
            />
          </div>
          <div className="fr-flex fr-flex-gap-2v">
            {state.activeIncomeTypes.length > 1 && (
              <Button
                priority="tertiary"
                title={t('removeIncomeTitle')}
                iconId="ri-delete-bin-line"
                size="small"
                onClick={() => handleRemoveIncomeType(type)}
              />
            )}
          </div>
        </div>
      ))}
      {canAddMore && (
        <Button iconId="ri-add-line" priority="secondary" size="small" onClick={handleAddIncomeType}>
          {t('addIncomeLabel')}
        </Button>
      )}
    </div>
  )
}
