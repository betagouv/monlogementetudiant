import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import PrepareBudgetContent from '~/app/(public)/preparer-mon-budget-etudiant/components/prepare-budget-content'
import { PrepareBudgetSidemenu } from '~/app/(public)/preparer-mon-budget-etudiant/components/prepare-budget-sidemenu'
import { getCanonicalUrl, getDefaultOgImage } from '~/utils/canonical'
import styles from './preparer-mon-budget-etudiant.module.css'

export const generateMetadata = async () => {
  const t = await getTranslations('metadata')
  return {
    title: t('prepareBudget.title'),
    description: t('prepareBudget.description'),
    alternates: { canonical: getCanonicalUrl('/preparer-mon-budget-etudiant') },
    openGraph: {
      title: t('prepareBudget.title'),
      description: t('prepareBudget.description'),
      siteName: 'Mon Logement Étudiant',
      locale: 'fr_FR',
      type: 'website',
      images: getDefaultOgImage(),
    },
    twitter: {
      card: 'summary_large_image' as const,
    },
  }
}

export default async function PrepareBudgetPage() {
  const [t, breadcrumbT] = await Promise.all([getTranslations('prepareBudget'), getTranslations('breadcrumbs')])
  return (
    <div className="fr-container">
      <div>
        <Breadcrumb
          currentPageLabel={breadcrumbT('prepareBudget')}
          homeLinkProps={{ href: '/' }}
          segments={[]}
          classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w fr-pt-2w' }}
        />
        <h1>{t('title')}</h1>
        <div className={clsx(styles.mainContainer, 'fr-col-12 fr-py-4w')}>
          <PrepareBudgetSidemenu />
          <PrepareBudgetContent />
        </div>
      </div>
    </div>
  )
}
