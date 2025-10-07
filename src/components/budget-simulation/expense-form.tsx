'use client'

import { Button } from '@codegouvfr/react-dsfr/Button'
import { Input } from '@codegouvfr/react-dsfr/Input'
import { Select } from '@codegouvfr/react-dsfr/Select'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { ExpenseType, useBudgetSimulator } from './budget-simulator-context'
import styles from './forms.module.css'

export function ExpenseForm() {
  const { state, updateMonthlyExpenses, addExpenseType, removeExpenseType } = useBudgetSimulator()
  const t = useTranslations('budgetSimulator.expenses')

  const handleExpenseChange = (type: ExpenseType, value: number) => {
    updateMonthlyExpenses({ [type]: value })
  }

  const expenseTypes = [
    'housing',
    'food',
    'enjoyment',
    'transport',
    'communication',
    'education',
    'healthcare',
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
      {state.activeExpenseTypes.map((type, index) => (
        <div key={type} className="fr-flex fr-align-items-end fr-flex-gap-4v">
          <div className={clsx('fr-flex-basis-0 fr-flex-grow-1', styles.sourceSelect)}>
            <Select
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
              {expenseTypes.map((expenseType) => (
                <option key={expenseType} value={expenseType}>
                  {t(`types.${expenseType}`)}
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
                value: state.monthlyExpenses[type] === 0 ? '' : state.monthlyExpenses[type],
                onChange: (e) => handleExpenseChange(type, Number(e.target.value) || 0),
              }}
              iconId="ri-money-euro-circle-line"
            />
          </div>
          <div className="fr-flex fr-flex-gap-2v">
            {index === state.activeExpenseTypes.length - 1 && canAddMore ? (
              <Button iconId="ri-add-line" title={t('addExpenseTitle')} priority="secondary" size="small" onClick={handleAddExpenseType} />
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
      ))}
    </div>
  )
}
