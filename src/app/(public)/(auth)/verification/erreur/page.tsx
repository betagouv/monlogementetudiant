import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('verification.error')
  return {
    title: t('title'),
  }
}

export default async function VerificationErrorPage() {
  const t = await getTranslations('verification.error')

  return (
    <div className="fr-container">
      <div className="fr-grid-row fr-grid-row--center fr-height-full fr-align-items-center">
        <div className="fr-col-12 fr-col-md-8 fr-col-lg-6">
          <div className="fr-mt-6w fr-mb-6w">
            <Alert severity="error" title={t('title')} description={t('description')} />

            <div className="fr-mt-4w">
              <p className="fr-text--lg fr-mb-3w">{t('whatToDo')}</p>

              <ul className="fr-mb-4w">
                <li>{t('instructions.checkLink')}</li>
                <li>{t('instructions.expiration')}</li>
                <li>{t('instructions.checkEmail')}</li>
              </ul>

              <div className="fr-btns-group">
                <Button
                  linkProps={{
                    href: '/se-connecter',
                  }}
                  priority="secondary"
                >
                  {t('buttons.login')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
