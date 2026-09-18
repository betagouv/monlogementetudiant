import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations('dossierFacileError')
  return { title: t('title') }
}

/** Types d'erreur transmis par la route de callback, chacun doté d'un message dans `dossierFacileError.messages`. */
const KNOWN_ERROR_TYPES = new Set([
  'missing_params',
  'missing_state',
  'invalid_state',
  'expired_state',
  'user_not_found',
  'sync_failed',
  'doc_invalid_link',
  'doc_not_found',
  'doc_unavailable',
  'doc_expired',
])

export default async function DossierFacileErrorPage({ searchParams }: { searchParams: Promise<{ error_type?: string }> }) {
  const t = await getTranslations('dossierFacileError')
  const { error_type } = await searchParams
  const description = error_type && KNOWN_ERROR_TYPES.has(error_type) ? t(`messages.${error_type}`) : t('default')

  return (
    <div className="fr-container">
      <div className="fr-grid-row fr-grid-row--center fr-height-full fr-align-items-center">
        <div className="fr-col-12 fr-col-md-8 fr-col-lg-6">
          <div className="fr-mt-6w fr-mb-6w">
            <Alert severity="error" title={t('title')} description={description} />

            <div className="fr-mt-4w fr-btns-group">
              <Button
                linkProps={{
                  href: '/',
                }}
                priority="secondary"
              >
                {t('backHome')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
