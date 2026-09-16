import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb'
import { Summary } from '@codegouvfr/react-dsfr/Summary'
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import styles from '../pages.module.css'

export const generateMetadata = async (): Promise<Metadata> => {
  const [tSiteMap, tMeta] = await Promise.all([getTranslations('siteMap'), getTranslations('metadata')])
  return { title: tSiteMap('title'), description: tMeta('siteMap.description') }
}

export default async function SiteMap() {
  const [t, breadcrumbT] = await Promise.all([getTranslations('siteMap'), getTranslations('breadcrumbs')])
  return (
    <div className="fr-container">
      <Breadcrumb
        currentPageLabel={breadcrumbT('sitemap')}
        homeLinkProps={{ href: '/' }}
        segments={[]}
        classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
      />

      <div className={styles.borderBottom}>
        <h1>{t('title')}</h1>
        <p>
          {t('lastUpdate')} <span className="fr-text--bold">01/01/25</span>
        </p>
      </div>
      <div className="fr-py-3w">
        <Summary
          links={[
            {
              linkProps: {
                href: '/',
              },
              text: t('links.home'),
            },
            {
              linkProps: {
                href: '/simuler-mes-aides-au-logement',
              },
              text: t('links.simulation'),
            },
            {
              linkProps: {
                href: '/preparer-sa-vie-etudiante',
              },
              text: t('links.prepareStudentLife'),
            },
            {
              linkProps: {
                href: '/trouver-un-logement-etudiant',
              },
              text: t('links.findAccomodation'),
            },
            {
              // La page locale a été retirée : les mentions légales vivent désormais sur le site
              // éditorial, où le pied de page pointe déjà.
              linkProps: {
                href: 'https://info.monlogementetudiant.beta.gouv.fr/mentions-legales/',
                target: '_blank',
                rel: 'noopener noreferrer',
              },
              text: t('links.legalMentions'),
            },
            {
              linkProps: {
                href: '/foire-aux-questions',
              },
              text: t('links.faq'),
            },
            {
              linkProps: {
                href: '/landing',
              },
              text: t('links.landing'),
            },
            {
              linkProps: {
                href: '/plan-du-site',
              },
              text: t('title'),
            },
          ]}
        />
      </div>
    </div>
  )
}
