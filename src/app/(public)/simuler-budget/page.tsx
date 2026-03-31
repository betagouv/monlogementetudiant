import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb'
import { getTranslations } from 'next-intl/server'
import { BudgetSimulatorProvider } from '~/components/budget-simulation/budget-simulator-context'
import { getCanonicalUrl } from '~/utils/canonical'
import { BudgetSimulatorContent } from './budget-simulator-content'
import styles from './simuler-budget.module.css'

export const generateMetadata = async () => {
  const t = await getTranslations('metadata')
  return {
    title: t('budgetSimulator.title'),
    description: t('budgetSimulator.description'),
    alternates: { canonical: getCanonicalUrl('/simuler-budget') },
  }
}

export default async function BudgetSimulatorPage() {
  const [t, breadcrumbT] = await Promise.all([getTranslations('budgetSimulator'), getTranslations('breadcrumbs')])

  return (
    <>
      <div className="primaryBackgroundColor">
        <div className="fr-container">
          <Breadcrumb
            currentPageLabel={breadcrumbT('budgetSimulator')}
            homeLinkProps={{ href: '/', className: 'fr-text-inverted--grey' }}
            segments={[]}
            classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w breadcrumbInverted', link: 'fr-text-inverted--grey' }}
          />
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
