import { fr } from '@codegouvfr/react-dsfr'
import Badge from '@codegouvfr/react-dsfr/Badge'
import { Button } from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { FAQ_CONTENTS } from '~/components/faq/faq-content'
import { FaqQuestionsAnswers } from '~/components/faq/faq-questions-answers'
import { HeroSearchBar } from '~/components/home/hero-search-bar'
import agefo from '~/images/agefo.svg'
import aquitanis from '~/images/aquitanis.svg'
import arpej from '~/images/arpej.svg'
import avatarCecilia from '~/images/avatar-cecilia.svg'
import avatarYasmine from '~/images/avatar-yasmine.svg'
import heneo from '~/images/heneo.svg'
import espacil from '~/images/espacil.svg'
import studefi from '~/images/studefi.svg'
import { getPopularCities } from '~/server/territories/get-popular-cities'
import { getCanonicalUrl } from '~/utils/canonical'
import styles from './home.module.css'

export const generateMetadata = async () => {
  const t = await getTranslations('metadata')
  return {
    description: t('home.description'),
    title: t('home.title'),
    robots: {
      index: process.env.NEXT_PUBLIC_APP_ENV === 'production',
      follow: process.env.NEXT_PUBLIC_APP_ENV === 'production',
    },
    alternates: { canonical: getCanonicalUrl() },
  }
}

export default async function Home() {
  const tHome = await getTranslations('home')
  const t = await getTranslations()
  const popularCities = await getPopularCities()
  const sortedPopularCities = popularCities.sort((a, b) => b.nb_total_apartments - a.nb_total_apartments).slice(0, 18)

  return (
    <>
      <section className={styles.heroSection}>
        <div className={styles.heroIllustrationLeft}>
          <Image
            src="/images/hero-illustration-left.svg"
            alt=""
            fill
            style={{ objectFit: 'contain', objectPosition: 'left bottom' }}
            priority
          />
        </div>
        <div className={fr.cx('fr-container')}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              {tHome('hero.title')}
              <br />
              {tHome('hero.titleHighlight')}
            </h1>
            <div className={styles.heroSearchContainer}>
              <HeroSearchBar />
            </div>
            <p className={styles.heroCounter} dangerouslySetInnerHTML={{ __html: tHome.raw('hero.counter') }} />
          </div>
        </div>
        <div className={styles.heroIllustrationRight}>
          <Image
            src="/images/hero-illustration-right.png"
            alt={tHome('hero.illustrationAlt')}
            fill
            style={{ objectFit: 'contain', objectPosition: 'right bottom' }}
            priority
          />
        </div>
      </section>

      <section className={clsx(fr.cx('fr-container'), styles.featuresSection)}>
        <div className={styles.featureCardsGrid}>
          <div className={clsx(styles.featureCard, styles.featureCardPurple)}>
            <Badge severity="new" noIcon className={styles.badgePurple}>
              {tHome('features.simulateAids.badge')}
            </Badge>
            <h2 className={clsx('fr-h3', styles.featureCardTitle)}>{tHome('features.simulateAids.title')}</h2>
            <p className={clsx(fr.cx('fr-text--lg'), styles.featureCardDescription)}>
              {tHome('features.simulateAids.description')}
            </p>
            <div className={styles.featureCardButtons}>
              <Button
                priority="secondary"
                iconId="ri-money-euro-circle-line"
                iconPosition="left"
                linkProps={{ href: '/simuler-mes-aides' }}
              >
                {tHome('features.simulateAids.button')}
              </Button>
              <div className={styles.featureCardLogos}>
                <Image src="/images/apl.svg" width={60} height={30} alt="APL" />
                <Image src="/images/logo-crous.svg" width={60} height={30} alt="CROUS" />
                <Image src="/images/caf.svg" width={60} height={30} alt="CAF" />
                <Image src="/images/al.svg" width={60} height={30} alt="Action Logement" />
                <Image src="/images/mobilijeune.svg" width={60} height={30} alt="Mobilijeune" />
              </div>
            </div>
          </div>

          <div className={clsx(styles.featureCard, styles.featureCardYellow)}>
            <Badge severity="info" noIcon className={styles.badgeYellow}>
              {tHome('features.calculateBudget.badge')}
            </Badge>
            <h2 className={clsx('fr-h3', styles.featureCardTitle)}>{tHome('features.calculateBudget.title')}</h2>
            <p className={clsx(fr.cx('fr-text--lg'), styles.featureCardDescription)}>
              {tHome('features.calculateBudget.description')}
            </p>
            <Button
              priority="secondary"
              iconId="ri-calculator-line"
              iconPosition="left"
              linkProps={{ href: '/preparer-mon-budget-etudiant' }}
            >
              {tHome('features.calculateBudget.button')}
            </Button>
          </div>
        </div>
      </section>

      <section className={clsx(fr.cx('fr-container'), styles.citiesSection)}>
        <div className={styles.citiesSectionContent}>
          <div className={styles.citiesIllustration}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/sofa-student.svg" alt={tHome('cities.illustrationAlt')} className={styles.citiesImage} />
          </div>
          <div className={styles.citiesContent}>
            <h2 className={clsx('fr-h2', styles.sectionTitle)}>{tHome('cities.title')}</h2>
            <div className={styles.citiesGrid}>
              {sortedPopularCities.map((city) => (
                <Button
                  className={styles.cityButton}
                  linkProps={{ href: `/trouver-un-logement-etudiant/ville/${city.name}${city.majority_crous ? '?crous=true' : ''}` }}
                  key={city.id}
                  priority="secondary"
                  size="small"
                >
                  {city.name}
                </Button>
              ))}
            </div>
            <Button
              priority="secondary"
              linkProps={{ href: '/trouver-un-logement-etudiant' }}
              iconPosition="right"
              iconId="ri-arrow-right-line"
            >
              {tHome('cities.moreButton')}
            </Button>
          </div>
        </div>
      </section>

      <section className={styles.facilitateSection}>
        <div className={fr.cx('fr-container')}>
          <div className={styles.facilitateSectionContent}>
            <div className={styles.facilitateIllustration} />
            <div className={styles.facilitateContent}>
              <h2 className={clsx('fr-h2', styles.facilitateTitle)}>{tHome('facilitate.title')}</h2>
              <ul className={styles.facilitateList}>
                <li className={styles.facilitateItem}>
                  <span className={fr.cx('ri-home-line', 'fr-mr-2w')} aria-hidden="true" />
                  {tHome('facilitate.items.offers')}
                </li>
                <li className={styles.facilitateItem}>
                  <span className={fr.cx('ri-calculator-line', 'fr-mr-2w')} aria-hidden="true" />
                  {tHome('facilitate.items.simulator')}
                </li>
                <li className={styles.facilitateItem}>
                  <span className={fr.cx('ri-money-euro-circle-line', 'fr-mr-2w')} aria-hidden="true" />
                  {tHome('facilitate.items.calculator')}
                </li>
                <li className={styles.facilitateItem}>
                  <span className={fr.cx('ri-notification-line', 'fr-mr-2w')} aria-hidden="true" />
                  {tHome('facilitate.items.alerts')}
                </li>
                <li className={styles.facilitateItem}>
                  <span className={fr.cx('ri-user-line', 'fr-mr-2w')} aria-hidden="true" />
                  {tHome('facilitate.items.account')}
                </li>
              </ul>
              <Button className={styles.facilitateButton} linkProps={{ href: '/inscription' }}>
                {tHome('facilitate.button')}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className={clsx(fr.cx('fr-container'), styles.newsSection)}>
        <h2 className={clsx('fr-h2', styles.sectionTitle)}>{tHome('news.title')}</h2>
        <p className={fr.cx('fr-text--lg', 'fr-mb-4w')}>{tHome('news.description')}</p>
        <div className={styles.newsGrid}>
          <article className={styles.newsCard}>
            <div className={styles.newsCardImage}>
              <Image src="/images/prepare-budget.webp" alt={tHome('news.articles.budget.imageAlt')} fill style={{ objectFit: 'cover' }} />
            </div>
            <div className={styles.newsCardContent}>
              <h3 className="fr-h6">{tHome('news.articles.budget.title')}</h3>
              <p>{tHome('news.articles.budget.description')}</p>
            </div>
          </article>
          <article className={styles.newsCard}>
            <div className={styles.newsCardImage}>
              <Image src="/images/explore-cities.webp" alt={tHome('news.articles.cities.imageAlt')} fill style={{ objectFit: 'cover' }} />
            </div>
            <div className={styles.newsCardContent}>
              <h3 className="fr-h6">{tHome('news.articles.cities.title')}</h3>
              <p>{tHome('news.articles.cities.description')}</p>
            </div>
          </article>
          <article className={styles.newsCard}>
            <div className={styles.newsCardImage}>
              <Image src="/images/background.webp" alt={tHome('news.articles.aids.imageAlt')} fill style={{ objectFit: 'cover' }} />
            </div>
            <div className={styles.newsCardContent}>
              <h3 className="fr-h6">{tHome('news.articles.aids.title')}</h3>
              <p>{tHome('news.articles.aids.description')}</p>
            </div>
          </article>
        </div>
        <div className={clsx(fr.cx('fr-mt-4w'), 'fr-flex fr-justify-content-center')}>
          <Button priority="secondary" linkProps={{ href: '/actualites' }} iconPosition="right" iconId="ri-arrow-right-line">
            {tHome('news.moreButton')}
          </Button>
        </div>
      </section>

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

      <section className={clsx(fr.cx('fr-container'), styles.faqSection)}>
        <h2 className={clsx('fr-h2', styles.sectionTitle)}>{tHome('faq.title')}</h2>
        <div className={styles.faqContent}>
          <FaqQuestionsAnswers contents={FAQ_CONTENTS.slice(0, 5)} />
        </div>
        <Button size="large" priority="secondary" linkProps={{ href: '/foire-aux-questions' }}>
          {tHome('faq.button')}
        </Button>
      </section>
    </>
  )
}
