import { fr } from '@codegouvfr/react-dsfr'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import styles from './prepare-budget-content-card.module.css'

export default async function PrepareBudgetContentHeader() {
  const t = await getTranslations('prepareBudget.content.header')
  const items = [
    { title: t('list.item1'), icon: 'ri-check-line' },
    { title: t('list.item2'), icon: 'ri-check-line' },
    { title: t('list.item3'), icon: 'ri-check-line' },
    { title: t('list.item4'), icon: 'ri-check-line' },
    { title: t('list.item5'), icon: 'ri-check-line' },
    { title: t('list.item6') },
  ]
  return (
    <div className={clsx(fr.cx('fr-py-2w'), styles.border)}>
      <div>
        <h3 className={fr.cx('fr-mb-2v')}>{t('title')}</h3>
        <p className={fr.cx('fr-mb-2v')}>{t('description')}</p>
        <ul className={styles.headerList}>
          {items.map((item, index) => (
            <li key={index}>
              {!!item.icon && <span className={clsx(styles.headerItem, styles.item, item.icon, 'fr-mr-1w')} />}
              {item.title}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
