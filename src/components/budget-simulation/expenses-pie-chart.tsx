'use client'

import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useBudgetSimulator } from './budget-simulator-context'
import styles from './budget-summary.module.css'

const expensesColors = {
  housing: '#ADADF9',
  dailyLife: '#FFB6C1',
  transport: '#B8FEC9',
  food: '#FCC63A',
  enjoyment: '#FB9175',
  communication: '#87CEEB',
  education: '#DDA0DD',
  healthcare: '#FABFF5',
  childcare: '#F0E68C',
  other: '#D3D3D3',
}

export function ExpensesPieChart() {
  const { state } = useBudgetSimulator()
  const t = useTranslations('budgetSimulator')

  const activeExpenses = state.activeExpenseTypes
    .map((type) => ({
      name: t(`expenses.types.${type}`),
      value: state.monthlyExpenses[type],
      type,
    }))
    .filter((expense) => expense.value > 0)

  if (activeExpenses.length === 0) {
    return null
  }

  const totalExpenses = activeExpenses.reduce((sum, expense) => sum + expense.value, 0)

  return (
    <div className={clsx(styles.border, 'fr-mt-4w fr-mb-2w')}>
      <div className="fr-py-2w fr-px-4w">
        <span className="fr-text-inverted--grey fr-h6 fr-mb-0">{t('summary.expensesBreakdown')}</span>
      </div>
      <div className="fr-flex fr-direction-column fr-direction-md-row fr-justify-content-center fr-align-items-center">
        <div style={{ height: '200px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={activeExpenses} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value">
                {activeExpenses.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={expensesColors[entry.type]} stroke="none" />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value}€`, t('summary.chartTooltipAmount')]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="fr-flex fr-direction-column fr-px-4w fr-py-2w">
          {activeExpenses.map((expense) => {
            const percentage = ((expense.value / totalExpenses) * 100).toFixed(1)
            return (
              <div key={expense.type} className="fr-flex fr-align-items-center">
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    backgroundColor: expensesColors[expense.type],
                    borderRadius: '50%',
                    marginRight: '8px',
                    flexShrink: 0,
                  }}
                />
                <div className="fr-flex fr-text--sm fr-mb-0">
                  <span className="fr-text-inverted--grey fr-mb-0 fr-text--bold">{expense.name}&nbsp;</span>
                  <span className="fr-text-inverted--grey fr-mb-0">({percentage}%)</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
