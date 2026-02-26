import { fr } from '@codegouvfr/react-dsfr'
import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb'
import { Summary } from '@codegouvfr/react-dsfr/Summary'
import { getTranslations } from 'next-intl/server'
import styles from '../pages.module.css'

export default async function SiteMap() {
  const [t, breadcrumbT] = await Promise.all([getTranslations('sitemap'), getTranslations('breadcrumbs')])
  return (
    <div className={fr.cx('fr-container')}>
      <Breadcrumb
        currentPageLabel={breadcrumbT('sitemap')}
        homeLinkProps={{ href: '/' }}
        segments={[]}
        classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
      />

      <div className={styles.borderBottom}>
        <h1>{t('title')}</h1>
        <p>
          Mis à jour le <span className={fr.cx('fr-text--bold')}>01/01/25</span>
        </p>
      </div>
      <div className={fr.cx('fr-py-3w')}>
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
            { linkProps: { href: '/alerte-logement' }, text: t('links.alertAccomodation') },
            {
              linkProps: {
                href: '/gestion-des-cookies',
              },
              text: t('links.cookies'),
            },
            {
              linkProps: {
                href: '/donnees-personnelles',
              },
              text: t('links.personalData'),
            },
            {
              linkProps: {
                href: '/accessibilite',
              },
              text: t('links.accessibilite'),
            },
            {
              linkProps: {
                href: '/mentions-legales',
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
