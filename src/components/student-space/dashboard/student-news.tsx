import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import avatarCecilia from '~/images/avatar-cecilia.svg'
import avatarYasmine from '~/images/avatar-yasmine.svg'
import styles from './student-news.module.css'

export const StudentNews = async () => {
  const t = await getTranslations('student.news')
  return (
    <div className="fr-flex fr-direction-column fr-flex-gap-4v fr-pt-4w fr-px-6w fr-pb-6w">
      <div className={styles.testimonialContainer}>
        <div
          className={clsx(
            'fr-flex fr-direction-column fr-align-items-center fr-justify-content-center fr-p-4w fr-p-md-8w',
            styles.testimonialContent,
          )}
        >
          <span className="fr-text--center fr-text--xl fr-mb-0">{t('dashboard.testimonial.quote')}</span>
          <div className="fr-flex fr-align-items-center fr-direction-md-row fr-direction-column fr-flex-gap-4v fr-mt-6w fr-position-relative">
            <Image src={avatarCecilia.src} alt={t('dashboard.testimonial.altText')} priority quality={100} width={56} height={56} />
            <Image
              className={styles.avatarYasmine}
              src={avatarYasmine.src}
              alt="Logo Yasmine"
              priority
              quality={100}
              width={56}
              height={56}
            />
            <div>
              <p className="fr-text--bold fr-mb-0">{t('dashboard.testimonial.author')}</p>
              <p className="fr-mb-0">{t('dashboard.testimonial.organization')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
