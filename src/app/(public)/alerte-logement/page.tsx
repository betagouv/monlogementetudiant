import { fr } from '@codegouvfr/react-dsfr'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import { AlertAccommodationForm } from '~/components/alert-accommodation/alert-accommodation-form'
import background from '~/images/background.webp'
import styles from './alert-logement.module.css'

export default async function AlerteLogement() {
  const t = await getTranslations('alertAccommodation')
  return (
    <div className={clsx(styles.container, fr.cx('fr-col-12'))}>
      <div className={fr.cx('fr-grid-row', 'fr-col-6')}>
        <Image
          src={background}
          alt="Restez alerté des dernières annonces"
          priority
          quality={100}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      <div className={clsx(styles.cardContainer, fr.cx('fr-col-6'))}>
        <h1 className={styles.title}>{t('title')}</h1>
        <p>{t('subTitle')}</p>
        <AlertAccommodationForm />
      </div>
    </div>
  )
}
