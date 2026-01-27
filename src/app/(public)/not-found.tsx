import { fr } from '@codegouvfr/react-dsfr'
import Button from '@codegouvfr/react-dsfr/Button'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { DynamicBreadcrumb } from '~/components/ui/breadcrumb'
import notFoundImage from '~/images/404.svg'

export default async function NotFound() {
  const t = await getTranslations('notFound')
  return (
    <div className={fr.cx('fr-container')}>
      <DynamicBreadcrumb />

      <div className={fr.cx('fr-py-3w')}>
        <h1>{t('title')}</h1>
        <hr />
        <div style={{ justifyContent: 'space-between' }} className={fr.cx('fr-grid-row')}>
          <div>
            <h3>{t('errorCode')}</h3>
            <div className={fr.cx('fr-col-md-8')}>
              <p>{t('description')}</p>
            </div>

            <div>
              <p style={{ margin: 0 }}>{t('description2')}</p>
              <p style={{ margin: 0 }}>{t('description3')}</p>
              <p>{t('description4')}</p>
            </div>

            <Button iconId="ri-arrow-left-line" iconPosition="left" linkProps={{ href: '/' }}>
              {t('button')}
            </Button>
          </div>
          <div>
            <Image src={notFoundImage.src} alt="Not found" width={282} height={320} />
          </div>
        </div>
      </div>
    </div>
  )
}
