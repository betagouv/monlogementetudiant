import { getTranslations } from 'next-intl/server'
import { BudgetSimulatorProvider } from '~/components/budget-simulation/budget-simulator-context'
import { DynamicBreadcrumb } from '~/components/ui/breadcrumb'
import { BudgetSimulatorContent } from './budget-simulator-content'
import styles from './simuler-budget.module.css'

export default async function BudgetSimulatorPage() {
  const t = await getTranslations('budgetSimulator')
  // todo - extract translations
  return (
    <>
      <div className="primaryBackgroundColor">
        <div className="fr-container">
          <DynamicBreadcrumb color="white" />
          <div className="fr-mb-4w">
            <h1 className="fr-mb-0">
              <span className="fr-text-inverted--grey">{t('titlePart1')}</span> <span className={styles.highlight}>{t('titlePart2')}</span>
            </h1>
            <span className="fr-text-inverted--grey fr-h5 fr-text--normal">{t('subtitle')}</span>
          </div>
          <BudgetSimulatorProvider>
            <BudgetSimulatorContent />
          </BudgetSimulatorProvider>
        </div>
      </div>
    </>
  )
}
