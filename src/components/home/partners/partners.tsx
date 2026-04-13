import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import afev from '~/images/afev.svg'
import alteal from '~/images/alteal.svg'
import arpej from '~/images/arpej.svg'
import avatarCecilia from '~/images/avatar-cecilia.svg'
import avatarYasmine from '~/images/avatar-yasmine.svg'
import espacil from '~/images/espacil.svg'
import fachabitat from '~/images/fac-habitat.svg'
import mgel from '~/images/mgel.svg'
import opal from '~/images/opal.svg'
import studefi from '~/images/studefi.svg'
import styles from './partners.module.css'

export const PartnersSection = async () => {
  const t = await getTranslations()
  const tHome = await getTranslations('home')
  const logos = [
    { src: arpej, alt: 'Logo Arpej' },
    { src: afev, alt: 'Logo Afev' },
    { src: espacil, alt: 'Logo Espacil' },
    { src: fachabitat, alt: 'Logo Fac Habitat' },
    { src: alteal, alt: 'Logo Alteal' },
    { src: opal, alt: 'Logo Opal' },
    { src: studefi, alt: 'Logo Studefi' },
    { src: mgel, alt: 'Logo Mgel' },
  ]

  return (
    <section className={styles.partnersSection}>
      <div className={styles.partnersLogos}>
        {logos.map((logo) => (
          <div key={logo.alt} className={styles.partnerLogoItem}>
            <Image src={logo.src} width={200} height={90} alt={logo.alt} className={styles.partnerLogoImage} />
          </div>
        ))}
      </div>
      <div className={styles.partnersContent}>
        <h2 className={clsx('fr-h1', styles.partnersTitle)}>
          {tHome('partners.title')} <span className={styles.partnersHighlight}>{tHome('partners.titleHighlight')}</span>
        </h2>
        <p className="fr-text--lg fr-mb-0">{tHome('partners.description')}</p>
        <div className={clsx('fr-flex fr-align-items-center fr-flex-gap-4v', styles.partnersContact)}>
          <div className={styles.partnersAvatars}>
            <Image src={avatarCecilia} alt="Cécilia" width={48} height={48} />
            <Image src={avatarYasmine} alt="Yasmine" width={48} height={48} className={styles.avatarOverlap} />
          </div>
          <div>
            <p className="fr-text--bold fr-mb-0">{t('landing.hero.contact.name')}</p>
            <p className="fr-mb-0">{t('landing.hero.contact.role')}</p>
          </div>
        </div>
        <Button priority="tertiary" className={styles.partnersButton} linkProps={{ href: '/landing', target: '_blank' }}>
          {tHome('partners.button')}
        </Button>
      </div>
    </section>
  )
}
