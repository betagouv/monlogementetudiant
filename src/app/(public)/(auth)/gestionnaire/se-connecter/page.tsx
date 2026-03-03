import { fr } from '@codegouvfr/react-dsfr'
import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { MagicLinkSignInForm } from '~/components/magic-link-sign-in/magic-link-sign-in'
import background from '~/images/background-owner.webp'
import authStyles from '../../auth.module.css'

export default async function LoginPage() {
  const t = await getTranslations('login')
  const calendlyUrl = z.string().parse(process.env.NEXT_PUBLIC_CALENDLY_URL)
  return (
    <>
      <div className={authStyles.imageContainer}>
        <Image className={authStyles.image} src={background} alt="Se connecter" priority quality={100} />
      </div>
      <div className={clsx(authStyles.container, fr.cx('fr-container'))}>
        <h1>{t('ownerTitle')}</h1>
        <p>
          {t('subTitlePart1')}
          &nbsp;<span className={clsx(fr.cx('fr-text--bold'), authStyles.required)}>*</span>
          &nbsp;{t('subTitlePart2')}
        </p>
        <MagicLinkSignInForm />
        <div className={authStyles.dividerContainer}>
          <span className={authStyles.divider}>{t('labels.or')}</span>
        </div>
        <div className={authStyles.firstVisitContainer}>
          <h2>{t('firstVisit.ownerTitle')}</h2>
          <p>{t('firstVisit.ownerDescription')}</p>
          <Button priority="secondary" iconPosition="left" iconId="ri-calendar-line" linkProps={{ href: calendlyUrl, target: '_blank' }}>
            {t('firstVisit.ownerCta')}
          </Button>
        </div>
      </div>
    </>
  )
}
