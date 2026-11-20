import Alert from '@codegouvfr/react-dsfr/Alert'
import { getTranslations } from 'next-intl/server'
import { NewWindowHint } from '~/components/ui/new-window'

const CROUS_HOUSING_URL = 'https://trouverunlogement.lescrous.fr/'

/** Encart des fiches de résidences Crous : les rares logements libres ne sont proposés que sur le site du Crous. */
export const AccommodationCrousAlert = async () => {
  const t = await getTranslations('accomodation.crousAlert')

  return (
    <Alert
      className="fr-mb-4w"
      severity="info"
      as="h2"
      title={t('title')}
      description={
        <>
          {t.rich('description', {
            link: (chunks) => (
              <a href={CROUS_HOUSING_URL} target="_blank" rel="noopener noreferrer" className="fr-link">
                {chunks}
                <NewWindowHint />
              </a>
            ),
          })}
        </>
      }
    />
  )
}
