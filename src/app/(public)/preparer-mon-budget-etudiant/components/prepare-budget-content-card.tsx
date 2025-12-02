import { fr } from '@codegouvfr/react-dsfr'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import PrepareBudgetChart from '~/app/(public)/preparer-mon-budget-etudiant/components/prepare-budget-chart'
import styles from './prepare-budget-content-card.module.css'

interface PrepareBudgetContentCardProps {
  translationKey: string
  itemsKeys: Array<string>
  withBorder?: boolean
  children?: React.ReactNode
  id: string
}

export default async function PrepareBudgetContentCard({
  translationKey,
  itemsKeys,
  children,
  withBorder = true,
  id,
}: PrepareBudgetContentCardProps) {
  const t = await getTranslations(translationKey)
  const items = itemsKeys.map((key) => ({ label: t(key) }))
  return (
    <div id={id} className={clsx(fr.cx('fr-py-4w'), withBorder && styles.border)}>
      <div className={styles.container}>
        <h3 className={fr.cx('fr-mb-0')}>{t('title')}</h3>
        <p className={fr.cx('fr-mb-0')} dangerouslySetInnerHTML={{ __html: t.raw('description') }} />
        <div className={styles.content}>
          <div className={styles.contentContainer}>
            <div>
              {t.has('list.title') && <h4 className={clsx(fr.cx('fr-mb-0'), 'fr-h7')}>{t('list.title')}</h4>}
              <div>
                {items.length > 0 && (
                  <ul className={styles.list}>
                    {items.map((item, index) => (
                      <li key={index}>{item.label}</li>
                    ))}
                  </ul>
                )}
                {t.has('descriptionSubList') && <p className={fr.cx('fr-mb-0')}>{t('descriptionSubList')}</p>}
              </div>
            </div>
            {children}
          </div>
          <div>{id === 'definir-vos-ressources-mensuelles' && <PrepareBudgetChart />}</div>
        </div>
      </div>
    </div>
  )
}
