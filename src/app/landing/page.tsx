import { fr } from '@codegouvfr/react-dsfr'
import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import { z } from 'zod'
import agefo from '~/images/agefo.svg'
import al from '~/images/al.svg'
import apl from '~/images/apl.svg'
import aquitanis from '~/images/aquitanis.svg'
import arpej from '~/images/arpej.svg'
import avatarCecilia from '~/images/avatar-cecilia.svg'
import avatarYasmine from '~/images/avatar-yasmine.svg'
import caf from '~/images/caf.svg'
import espacil from '~/images/espacil.svg'
import heneo from '~/images/heneo.svg'
import landingStep1 from '~/images/landing-step-1.svg'
import landingStep2 from '~/images/landing-step-2.svg'
import landingStep3 from '~/images/landing-step-3.svg'
import landingHero from '~/images/landing.webp'
import crous from '~/images/logo-crous.svg'
import ministereEnseignementSup from '~/images/logo-esr.svg'
import logo from '~/images/logo.svg'
import mmh from '~/images/mmh.svg'
import poingFerme from '~/images/poing-ferme.svg'
import sogima from '~/images/sogima.svg'
import studefi from '~/images/studefi.svg'
import visibilityAvatar from '~/images/visibility.webp'
import styles from './landing.module.css'

export default async function LandingPage() {
  const t = await getTranslations('landing')
  const calendlyUrl = z.string().parse(process.env.NEXT_PUBLIC_CALENDLY_URL)

  return (
    <>
      <div className="primaryBackgroundColor">
        <div className={fr.cx('fr-container')}>
          <div className={styles.heroContent}>
            <div className={clsx(fr.cx('fr-col-md-8'), styles.heroTextContent)}>
              <h1 className={styles.heroTitle}>
                {t('hero.title')}
                <span className={styles.highlight}> {t('hero.highlight')}</span>
              </h1>
              <p className={styles.heroDescription}>
                <span className={styles.bold}>Mon Logement Étudiant</span> {t('hero.description')}
              </p>
              <div className={styles.contactSection}>
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
                    <p className="fr-mb-0 fr-text--bold">{t('hero.contact.name')}</p>
                    <p className="fr-mb-0">{t('hero.contact.role')}</p>
                  </div>
                </div>
                <div className={styles.contactButton}>
                  <Button className="whiteButton" priority="secondary" linkProps={{ href: calendlyUrl, target: '_blank' }}>
                    {t('hero.contact.button')}
                  </Button>
                </div>
              </div>
            </div>
            <div className={clsx(styles.heroImage, fr.cx('fr-col-md-4'))}>
              <Image src={landingHero} quality={100} priority alt="Image de la landing page" />
            </div>
          </div>
        </div>
      </div>

      <div className={clsx(styles.partnersSection, fr.cx('fr-hidden', 'fr-unhidden-sm'))}>
        <div className={fr.cx('fr-container', 'fr-py-8v')}>
          <p className={styles.partnersTitle}>
            {t('partners.title')} <span className={fr.cx('fr-text--bold')}>{t('partners.mle')}</span>
          </p>
          <div className={styles.partnersContainer}>
            <Image src={arpej} width={200} height={90} quality={100} priority alt="Logo Arpej" />
            <Image src={espacil} width={200} height={90} quality={100} priority alt="Logo Espacil" />
            <Image src={aquitanis} width={200} height={90} quality={100} priority alt="Logo Aquitanis" />
            <Image src={agefo} width={200} height={90} quality={100} priority alt="Logo Agefo" />
            <Image src={sogima} width={200} height={90} quality={100} priority alt="Logo Sogima" />
            <Image src={mmh} width={200} height={90} quality={100} priority alt="Logo Meurthe et Moselle Habitat" />
            <Image src={heneo} width={200} height={90} quality={100} priority alt="Logo Heneo" />
            <Image src={studefi} width={200} height={90} quality={100} priority alt="Logo Studefi" />
          </div>
        </div>
      </div>

      <div className={clsx(fr.cx('fr-container'), styles.mainSection)}>
        <h1 className={styles.mainTitle}>{t('features.mainTitle')}</h1>
        <div className={styles.featuresContainer}>
          <div className={`${fr.cx('fr-col-md-4')} ${styles.featureCard}`}>
            <div className={styles.featureImageContainer}>
              <Image src={visibilityAvatar} quality={100} priority alt="Gagnez en visibilité" />
            </div>
            <h2>{t('features.visibility.title')}</h2>
            <span>
              {t('features.visibility.description')}
              <span className={fr.cx('fr-text--bold')}>{t('features.visibility.free')}</span>
            </span>
          </div>

          <div className={styles.rightFeatures}>
            <div className={styles.topFeatureCard}>
              <div className={styles.featureContent}>
                <h3>{t('features.priority.title')}</h3>
                <span>{t('features.priority.description')}</span>
              </div>
              <Image src={logo.src} width={120} height={120} quality={100} priority alt="Logo Mon Logement Etudiant" />
            </div>

            <div className={styles.bottomFeatures}>
              <div className={styles.impactCard}>
                <h4>{t('features.impact.title')}</h4>
                <span>{t('features.impact.description')}</span>
                <div className={styles.poingContainer}>
                  <Image src={poingFerme.src} width={400} height={300} alt="Logo poing fermé" />
                </div>
              </div>

              <div className={styles.initiativeCard}>
                <div>
                  <h4>{t('features.initiative.title')}</h4>
                  <span>{t('features.initiative.description')}</span>
                </div>
                <div className={styles.enseignementSup}>
                  <Image src={ministereEnseignementSup.src} width={178} height={120} alt="Logo de l'enseignement supérieur" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={fr.cx('fr-container')}>
        <h2 className={styles.missionTitle}>
          {t('mission.title.part1')} <br />
          {t('mission.title.part2')} <br />
          {t('mission.title.part3')}
        </h2>
        <div className={styles.stepsContainer}>
          <div className={styles.verticalLine}>
            <div className={styles.circleTop}></div>
            <div className={styles.circleBottom}></div>
          </div>
          <div className={`${fr.cx('fr-col-md-6')} ${styles.stepColumn}`}>
            <div className={styles.purpleBox}>
              <Image
                src={landingStep1.src}
                className={clsx(styles.stepsImage, styles.firstStepImage)}
                width={574}
                height={450}
                alt="Étape 1 - Je simule mes aides au logement"
              />
            </div>
            <div className={styles.stepContent}>
              <div className={styles.stepBadge}>{t('steps.step2.badge')}</div>
              <h2>{t('steps.step2.title')}</h2>
              <p className={styles.noMargin}>{t('steps.step2.description')}</p>
              <span className={fr.cx('ri-community-line')}>{t('steps.step2.features.info')}</span>
              <span className={fr.cx('ri-line-chart-line')}>{t('steps.step2.features.pressure')}</span>
              <span className={fr.cx('ri-money-dollar-circle-line')}>{t('steps.step2.features.price')}</span>
              <span className={fr.cx('ri-shopping-bag-line')}>{t('steps.step2.features.cost')}</span>
            </div>
            <div className={clsx('primaryBackgroundColor', styles.secondStepImage)}>
              <Image
                src={landingStep3.src}
                className={clsx(styles.stepsImage, styles.secondStepImage)}
                width={574}
                height={450}
                alt="Étape 3 - Je trouve un logement étudiant"
              />
            </div>
          </div>
          <div className={clsx(fr.cx('fr-col-md-6'), styles.stepColumn)}>
            <div className={styles.stepContent}>
              <div className={styles.stepBadge}>{t('steps.step1.badge')}</div>
              <h2>{t('steps.step1.title')}</h2>
              <p>{t('steps.step1.description')}</p>
              <div className={styles.logoContainer}>
                <Image src={apl.src} width={30} height={30} alt="Logo APL" />
                <Image src={caf.src} width={30} height={30} alt="Logo CAF" />
                <Image src={crous.src} width={30} height={30} alt="Logo Crous" />
                <Image src={al.src} width={30} height={30} alt="Logo AL" />
                <span>{t('steps.step1.organismsCount')}</span>
              </div>
            </div>

            <div className={styles.purpleBox}>
              <Image
                src={landingStep2.src}
                width={574}
                height={450}
                className={clsx(styles.stepsImage, styles.secondStepImage)}
                alt="Étape 2 - Je prépare ma vie étudiante"
              />
            </div>
            <div className={styles.stepContent}>
              <div className={styles.stepBadge}>{t('steps.step3.badge')}</div>
              <h2>{t('steps.step3.title')}</h2>
              <p>{t('steps.step3.description')}</p>
            </div>
          </div>
        </div>

        <div className={styles.callToAction}>
          <h2 className={styles.callToActionTitle}>
            {t('callToAction.title.part1')}
            <br />
            {t('callToAction.title.part2')}
          </h2>
          <div className={styles.buttonContainer}>
            <Button>
              <a href={calendlyUrl} target="_blank">
                {t('callToAction.button')}
              </a>
            </Button>
          </div>
          <div className={styles.profileContainer}>
            <div className="fr-flex fr-position-relative">
              <Image src={avatarCecilia.src} alt={t('callToAction.contact.role')} quality={100} width={56} height={56} />
              <Image src={avatarYasmine.src} alt={t('callToAction.contact.role')} quality={100} width={56} height={56} />
            </div>
            <div className={styles.profileDetails}>
              <p className={styles.profileName}>{t('callToAction.contact.name')}</p>
              <p className={styles.profileRole}>{t('callToAction.contact.role')}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
