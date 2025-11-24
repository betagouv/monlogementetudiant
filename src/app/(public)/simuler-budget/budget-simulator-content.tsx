import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { BudgetSection } from '~/components/budget-simulation/budget-section'
import { BudgetSummary } from '~/components/budget-simulation/budget-summary'
import { ExpenseForm } from '~/components/budget-simulation/expense-form'
import { IncomeForm } from '~/components/budget-simulation/income-form'
import styles from './simuler-budget.module.css'

export function BudgetSimulatorContent() {
  const t = useTranslations('budgetSimulator.sections')

  return (
    <div className="fr-flex fr-direction-column fr-direction-md-row fr-pb-12w">
      <div className="fr-background-default--grey fr-col-md-7">
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
      </div>
      <div className={clsx(styles.summaryContainer, 'fr-col-md-5')}>
        <BudgetSummary />
      </div>
    </div>
  )
}
