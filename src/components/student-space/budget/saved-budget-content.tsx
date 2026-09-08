'use client'

import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { BudgetSection } from '~/components/budget-simulation/budget-section'
import { BudgetSimulatorProvider } from '~/components/budget-simulation/budget-simulator-context'
import { ExpenseForm } from '~/components/budget-simulation/expense-form'
import { IncomeForm } from '~/components/budget-simulation/income-form'
import type { TBudgetSimulation } from '~/schemas/budget-simulation'
import { BudgetAutosave } from './budget-autosave'
import { BudgetSummaryCard } from './budget-summary-card'
import styles from './saved-budget.module.css'

interface SavedBudgetContentProps {
  initialState: TBudgetSimulation | null
}

export function SavedBudgetContent({ initialState }: SavedBudgetContentProps) {
  const t = useTranslations('budgetSimulator.sections')

  return (
    <BudgetSimulatorProvider initialState={initialState ?? undefined} trackStart={false}>
      <BudgetAutosave />
      <BudgetSummaryCard />
      <div className="fr-border-bottom">
        <BudgetSection
          icon={clsx(styles.euroIcon, 'ri-money-euro-circle-line')}
          iconSize={styles.iconSize}
          title={t('income.title')}
          subtitle={t('income.subtitle')}
        >
          <IncomeForm />
        </BudgetSection>
      </div>
      <BudgetSection
        icon="ri-shopping-cart-line"
        iconSize={styles.iconSize}
        iconColor="fr-text-default--error"
        title={t('expenses.title')}
        subtitle={t('expenses.subtitle')}
      >
        <ExpenseForm />
      </BudgetSection>
    </BudgetSimulatorProvider>
  )
}
