import { fr } from '@codegouvfr/react-dsfr'
import { Button } from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { FAQ_CONTENTS } from '~/components/faq/faq-content'
import { FaqQuestionsAnswers } from '~/components/faq/faq-questions-answers'
import { FindAccommodationForm } from '~/components/find-student-accomodation/home/find-accommodation-form'
import agefo from '~/images/agefo.svg'
import aquitanis from '~/images/aquitanis.svg'
import arpej from '~/images/arpej.svg'
import avatarCecilia from '~/images/avatar-cecilia.svg'
import avatarYasmine from '~/images/avatar-yasmine.svg'
import background from '~/images/background.webp'
import espacil from '~/images/espacil.svg'
import exploreCities from '~/images/explore-cities.webp'
import heneo from '~/images/heneo.svg'
import home from '~/images/landing.webp'
import mmn from '~/images/mmn.svg'
import prepareBudget from '~/images/prepare-budget.webp'
import sogima from '~/images/sogima.svg'
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
      <div className="primaryBackgroundColor">
        <div className={fr.cx('fr-container')}>
          <div className={styles.heroContent}>
            <div className={clsx(fr.cx('fr-col-md-7'), styles.heroTextContainer)}>
              <h1 className={styles.heroTitle}>
                {tHome('hero.title')} <span className={styles.heroHighlight}>{tHome('hero.highlight')}</span>
              </h1>
              <h2 className={styles.heroSubtitle}>{tHome('hero.subtitle')}</h2>
            </div>
            <div className={clsx(fr.cx('fr-col-md-5'), 'boxShadow', styles.simulatorCard)}>
              <h3 className="fr-h2">{tHome('title')}</h3>
              <p className="fr-text--lg">{tHome('description')}</p>
              <div className={styles.logoContainer}>
                <Image src={espacil.src} width={120} height={50} alt="Logo Espacil" />
                <Image src={arpej.src} width={120} height={50} alt="Logo Arpej" />
                <Image src={studefi.src} width={120} height={50} alt="Logo Studefi" />
              </div>
              <div className={styles.fullWidth}>
                <Button
                  size="large"
                  linkProps={{ href: '/trouver-un-logement-etudiant' }}
                  className={styles.fullWidthButton}
                  iconId="ri-search-line"
                >
                  {tHome('cta')}
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.heroImageContainer}>
          <Image className={styles.heroImage} priority quality={100} src={home} alt="Hero" />
        </div>
        <div className="fr-flex fr-justify-content-center">
          <Image className={clsx(fr.cx('fr-hidden-sm'), styles.heroImageMobile)} priority quality={100} src={home} alt="Hero" />
        </div>
      </div>
      <div className={clsx(fr.cx('fr-container'), styles.mainContainer)}>
        <div className={clsx(fr.cx('fr-container'), styles.headerSection)}>
          <h2 className={clsx('fr-h1', styles.headerSectionTitle)}>{tHome('mainSection.title')}</h2>
          <p className="fr-text--lg">
            {tHome.rich('mainSection.description', {
              part1: (chunks) => <>{chunks}</>,
              part2: (chunks) => (
                <>
                  <br />
                  {chunks}
                </>
              ),
            })}
          </p>
        </div>
        <div className={styles.featuresContainer}>
          <div className={clsx('boxShadow', styles.featureCard)}>
            <div className={styles.cardContent}>
              <h3 className={clsx('fr-h1', styles.cardTitle)}>{tHome('features.exploreCities.title')}</h3>
              <div className={styles.citiesGrid}>
                {sortedPopularCities.map((city) => (
                  <Button
                    className={styles.cityButton}
                    linkProps={{ href: `/trouver-un-logement-etudiant/ville/${city.slug}` }}
                    key={city.id}
                    priority="secondary"
                  >
                    {city.name}
                  </Button>
                ))}
                <div className={styles.moreContainer}>
                  <Button
                    priority="secondary"
                    linkProps={{ href: `/trouver-un-logement-etudiant` }}
                    iconPosition="right"
                    iconId="fr-icon-arrow-right-line"
                  >
                    {tHome('features.exploreCities.moreButton')}
                  </Button>
                </div>
              </div>
            </div>
            <div className={fr.cx('fr-col-md-6')}>
              <Image src={exploreCities} className={styles.featureImage} alt="Explorer les villes étudiantes" priority quality={100} />
            </div>
          </div>
          <div className={clsx('boxShadow', styles.featureCard)}>
            <div className={fr.cx('fr-col-md-6')}>
              <Image
                src={background}
                className={clsx(fr.cx('fr-hidden', 'fr-unhidden-sm'), styles.featureImage)}
                quality={100}
                alt="Trouver votre prochain logement étudiant"
              />
            </div>
            <div className={styles.cardContent}>
              <h3 className={clsx('fr-h1', styles.cardTitle)}>{tHome('features.findAccommodation.title')}</h3>
              <FindAccommodationForm />
            </div>
            <Image
              src={background}
              className={clsx(fr.cx('fr-hidden-sm'), styles.featureImage)}
              quality={100}
              alt="Trouver votre prochain logement étudiant"
            />
          </div>
          <div className={clsx('boxShadow', styles.featureCard)}>
            <div className={styles.cardContent}>
              <div>
                <h3 className={clsx('fr-h1', styles.cardTitle)}>{tHome('features.prepareBudget.title')}</h3>
                <p className="fr-text--lg">{tHome('features.prepareBudget.description')}</p>
              </div>
              <Button size="large" linkProps={{ href: '/preparer-mon-budget-etudiant' }}>
                {tHome('features.prepareBudget.button')}
              </Button>
            </div>
            <div className={fr.cx('fr-col-md-6')}>
              <Image src={prepareBudget} className={styles.featureImage} alt="Préparer son budget étudiant" priority quality={100} />
            </div>
          </div>
        </div>
      </div>
      {/* <div className={styles.partnersSection}>
        <div className={fr.cx('fr-container')}>
          <h2 className={styles.partnersHeader}>{t('partners.title')}</h2>
          <div className={styles.partnersGrid}>
            <Image src={arpej} alt="Logo Arpej" quality={100} width={201} height={90} />
            <Image src={espacil} alt="Logo Espacil" quality={100} width={201} height={90} />
            <Image src={sogima} alt="Logo Sogima" quality={100} width={201} height={90} />
            <Image src={studefi} alt="Logo Studefi" quality={100} width={201} height={90} />
          </div>
        </div>
      </div> */}
      <div className="fr-hidden fr-unhidden-sm">
        <div className="primaryBackgroundColor fr-flex fr-justify-content-space-between">
          <div className={clsx('fr-p-6w fr-width-full', styles.partners)}>
            <Image src={arpej.src} width={200} height={90} alt="Logo Arpej" />
            <Image src={agefo.src} width={200} height={90} alt="Logo Agefo" />
            <Image src={sogima.src} width={200} height={90} alt="Logo Sogima" />
            <Image src={espacil.src} width={200} height={90} alt="Logo Espacil" />
            <Image src={studefi.src} width={200} height={90} alt="Logo Studefi" />
            <Image src={aquitanis.src} width={200} height={90} alt="Logo Aquitanis" />
            <Image src={heneo.src} width={200} height={90} alt="Logo Hénéo" />
            <Image src={mmn.src} width={200} height={90} alt="Logo Meurthe et Moselle Habitat" />
          </div>
          <div className="fr-p-8w fr-width-full fr-flex fr-direction-column fr-justify-content-center fr-flex-gap-6v">
            <span className="fr-h1 fr-text-inverted--grey fr-mb-0">
              {tHome('social.titlePart1')}&nbsp;
              <span className={styles.partnersHighlightedTitle}>{tHome('social.titlePart2')}</span>
            </span>
            <p className="fr-mb-0 fr-text-inverted--grey">{tHome('social.description')}</p>
            <div className={clsx('fr-text-inverted--grey fr-flex fr-flex-gap-4v fr-position-relative')}>
              <Image src={avatarCecilia.src} alt="Logo Cécilia" priority quality={100} width={56} height={56} />
              <Image
                className={styles.avatarYasmine}
                src={avatarYasmine.src}
                alt="Logo Yasmine"
                priority
                quality={100}
                width={56}
                height={56}
              />
              <div className="fr-flex fr-direction-column fr-ml-5w">
                <p className="fr-mb-0 fr-text--bold">{t('landing.hero.contact.name')}</p>
                <p className="fr-mb-0">{t('landing.hero.contact.role')}</p>
              </div>
            </div>
            <Button className="whiteButton" priority="secondary" linkProps={{ href: '/landing', target: '_blank' }}>
              {t('landing.hero.contact.button')}
            </Button>
          </div>
        </div>
      </div>
      <div className={clsx(fr.cx('fr-container'), styles.faqContainer)}>
        <div className={styles.faqContent}>
          <div>
            <h3 className={clsx('fr-h1', styles.faqHeader)}>{tHome('faq.title')}</h3>
          </div>

          <FaqQuestionsAnswers contents={FAQ_CONTENTS.slice(0, 5)} />

          <Button size="large" priority="secondary" linkProps={{ href: '/foire-aux-questions' }}>
            {tHome('faq.button')}
          </Button>
        </div>
      </div>
    </>
  )
}
