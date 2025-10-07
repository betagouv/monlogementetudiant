'use client'

import { Button } from '@codegouvfr/react-dsfr/Button'
import { Input } from '@codegouvfr/react-dsfr/Input'
import { Select } from '@codegouvfr/react-dsfr/Select'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useBudgetSimulator } from './budget-simulator-context'
import styles from './forms.module.css'

type IncomeType = 'salary' | 'housingAssistance' | 'other'

export function IncomeForm() {
  const { state, updateMonthlyIncomes, addIncomeType, removeIncomeType } = useBudgetSimulator()
  const t = useTranslations('budgetSimulator.income')

  const incomeTypes: IncomeType[] = ['salary', 'housingAssistance', 'other']

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
      {state.activeIncomeTypes.map((type, index) => (
        <div key={type} className="fr-flex fr-align-items-end fr-flex-gap-4v">
          <div className={clsx('fr-flex-basis-0 fr-flex-grow-1', styles.sourceSelect)}>
            <Select
              label={t('sourceLabel')}
              nativeSelectProps={{
                value: type,
                onChange: (e) => {
                  // Remove old type and add new one
                  const oldAmount = state.monthlyIncomes[type]
                  removeIncomeType(type)
                  addIncomeType(e.target.value as IncomeType)
                  updateMonthlyIncomes({ [e.target.value as IncomeType]: oldAmount })
                },
              }}
            >
              {incomeTypes.map((incomeType) => (
                <option key={incomeType} value={incomeType}>
                  {t(`types.${incomeType}`)}
                </option>
              ))}
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
            {index === state.activeIncomeTypes.length - 1 && canAddMore ? (
              <Button iconId="ri-add-line" title={t('addIncomeTitle')} priority="secondary" size="small" onClick={handleAddIncomeType} />
            ) : (
              state.activeIncomeTypes.length > 1 && (
                <Button
                  priority="tertiary"
                  title={t('removeIncomeTitle')}
                  iconId="ri-delete-bin-line"
                  size="small"
                  onClick={() => handleRemoveIncomeType(type)}
                />
              )
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
