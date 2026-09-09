import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb'
import { Table } from '@codegouvfr/react-dsfr/Table'
import clsx from 'clsx'
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import styles from './budget.module.css'

export const generateMetadata = async (): Promise<Metadata> => {
  const [tBudget, tMeta] = await Promise.all([getTranslations('budget'), getTranslations('metadata')])
  return { title: tBudget('title'), description: tMeta('budget.description') }
}

export default async function BudgetPage() {
  const [t, breadcrumbT] = await Promise.all([getTranslations('budget'), getTranslations('breadcrumbs')])
  return (
    <div className="fr-container">
      <Breadcrumb
        currentPageLabel={breadcrumbT('budget')}
        homeLinkProps={{ href: '/' }}
        segments={[]}
        classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
      />
      <div className="fr-container">
        <h1>{t('title')}</h1>
        <p>
          {t('lastUpdate')} <span className="fr-text--bold">08/09/26</span>
        </p>
        <div className={clsx('fr-p-4w', styles.mainContainer)}>
          <p className={clsx('fr-text--bold', styles.description)}>{t('description')}</p>
          <p>{t('description2')}</p>
          <hr />
          <h2>{t('repartition')}</h2>
          <div>
            <Table
              fixed
              noCaption
              caption={t('repartition')}
              data={[
                [t('table.coaching'), '16 128€', '33 984 €', '46 080 €', '63 360 €', '39 216 €'],
                [t('table.development'), '0 €', '55 062 €', '65 990 €', '92 393 €', '87 350 €'],
                [t('table.design'), '0 €', '27 463 €', '21 437 €', '36 590 €', '22 579 €'],
                [t('table.deployment'), '0 €', '24 077 €', '32 256 €', '86 352 €', '65 251 €'],
                [t('table.communication'), '0 €', '0 €', '0 €', '35 953 €', '23 184 €'],
                [t('table.total'), '16 128 €', '140 586 €', '165 763 €', '314 648 €', '237 580 €'],
              ]}
              headers={[
                '',
                t('investigationDate'),
                t('constructionDate'),
                t('constructionDatePart2'),
                t('accelerationDate'),
                t('accelerationDatePart2'),
              ]}
              className={styles.boldTable}
            />
            <p>
              {t('total')}&nbsp;
              <span className="fr-text--bold">874 705€ TTC.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
