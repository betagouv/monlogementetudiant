import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const [tVerif, tMeta] = await Promise.all([getTranslations('verification.error'), getTranslations('metadata')])
  return {
    title: tVerif('title'),
    description: tMeta('verificationError.description'),
  }
}

/** Le lien de connexion étant propre à un espace, on ramène l'utilisateur au bon formulaire. */
const LOGIN_PATH_BY_ROLE: Record<string, string> = {
  owner: '/gestionnaire/se-connecter',
  admin: '/administration/se-connecter',
}

const DEFAULT_LOGIN_PATH = '/se-connecter'

interface VerificationErrorPageProps {
  searchParams: Promise<{ role?: string }>
}

export default async function VerificationErrorPage({ searchParams }: VerificationErrorPageProps) {
  const t = await getTranslations('verification.error')
  const { role } = await searchParams

  // Appelant inconnu ou paramètre absent : le login étudiant, qui est l'espace grand public.
  const loginPath = (role && LOGIN_PATH_BY_ROLE[role]) ?? DEFAULT_LOGIN_PATH

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
                    href: loginPath,
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
