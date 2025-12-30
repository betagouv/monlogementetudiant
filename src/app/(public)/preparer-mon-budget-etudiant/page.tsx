import { fr } from '@codegouvfr/react-dsfr'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import PrepareBudgetContent from '~/app/(public)/preparer-mon-budget-etudiant/components/prepare-budget-content'
import { PrepareBudgetSidemenu } from '~/app/(public)/preparer-mon-budget-etudiant/components/prepare-budget-sidemenu'
import { DynamicBreadcrumb } from '~/components/ui/breadcrumb'
import styles from './preparer-mon-budget-etudiant.module.css'

export default async function PrepareBudgetPage() {
  const t = await getTranslations('prepareBudget')
  return (
    <div className={fr.cx('fr-container')}>
      <div>
        <DynamicBreadcrumb />
        <h1>{t('title')}</h1>
        <div className={clsx(styles.mainContainer, fr.cx('fr-col-12'))}>
          <PrepareBudgetSidemenu />
          <PrepareBudgetContent />
        </div>
      </div>
    </div>
  )
}
