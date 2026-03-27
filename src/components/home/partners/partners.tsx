import { fr } from '@codegouvfr/react-dsfr'
import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import agefo from '~/images/agefo.svg'
import aquitanis from '~/images/aquitanis.svg'
import arpej from '~/images/arpej.svg'
import avatarCecilia from '~/images/avatar-cecilia.svg'
import avatarYasmine from '~/images/avatar-yasmine.svg'
import espacil from '~/images/espacil.svg'
import heneo from '~/images/heneo.svg'
import studefi from '~/images/studefi.svg'
import styles from './partners.module.css'

export const PartnersSection = async () => {
  const t = await getTranslations()
  const tHome = await getTranslations('home')
  return (
    <section className={styles.partnersSection}>
      <div className={fr.cx('fr-container')}>
        <div className={styles.partnersSectionContent}>
          <div className={styles.partnersLogos}>
            <Image src={espacil} width={120} height={60} alt="Logo Espacil" />
            <Image src={heneo} width={120} height={60} alt="Logo Hénéo" />
            <Image src={arpej} width={120} height={60} alt="Logo Arpej" />
            <Image src={studefi} width={120} height={60} alt="Logo Studefi" />
            <Image src={agefo} width={120} height={60} alt="Logo Agefo" />
            <Image src={aquitanis} width={120} height={60} alt="Logo Aquitanis" />
          </div>
          <div className={styles.partnersContent}>
            <h2 className={clsx('fr-h2', styles.partnersTitle)}>
              {tHome('partners.title')} <span className={styles.partnersHighlight}>{tHome('partners.titleHighlight')}</span>
            </h2>
            <p className={fr.cx('fr-text--lg', 'fr-mb-4w')}>{tHome('partners.description')}</p>
            <div className={styles.partnersContact}>
              <div className={styles.partnersAvatars}>
                <Image src={avatarCecilia} alt="Cécilia" width={48} height={48} />
                <Image src={avatarYasmine} alt="Yasmine" width={48} height={48} className={styles.avatarOverlap} />
              </div>
              <div>
                <p className={fr.cx('fr-text--bold', 'fr-mb-0')}>{t('landing.hero.contact.name')}</p>
                <p className={fr.cx('fr-mb-0')}>{t('landing.hero.contact.role')}</p>
              </div>
            </div>
            <Button className={styles.partnersButton} linkProps={{ href: '/landing', target: '_blank' }}>
              {tHome('partners.button')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
