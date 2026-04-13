import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb'
import Button from '@codegouvfr/react-dsfr/Button'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { CommonFooter } from '~/components/ui/footer/footer'
import { CommonHeader } from '~/components/ui/header/common-header'
import notFoundImage from '~/images/404.svg'

export default async function NotFound() {
  const t = await getTranslations('notFound')
  const breadcrumbT = await getTranslations('breadcrumbs')
  return (
    <>
      <CommonHeader />
      <div className="fr-container">
        <Breadcrumb
          currentPageLabel={breadcrumbT('notFound')}
          homeLinkProps={{ href: '/' }}
          segments={[]}
          classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
        />

        <div className="fr-py-3w">
          <h1>{t('title')}</h1>
          <hr />
          <div style={{ justifyContent: 'space-between' }} className="fr-grid-row">
            <div>
              <h3>{t('errorCode')}</h3>
              <div className="fr-col-md-8">
                <p>{t('description')}</p>
              </div>

              <div>
                <p className="fr-m-0">{t('description2')}</p>
                <p className="fr-m-0">{t('description3')}</p>
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
      <CommonFooter />
    </>
  )
}
