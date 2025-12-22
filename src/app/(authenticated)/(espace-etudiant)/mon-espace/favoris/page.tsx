import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { StudentFavorites } from '~/components/student-space/favorites/student-favorites'
import styles from '../mon-espace.module.css'

export default async function StudentFavoritesPage() {
  return (
    <>
      <div className="fr-border-right fr-border-top fr-border-bottom fr-px-6w fr-py-5w">
        <h1>Favoris</h1>
        <span className="fr-text--xl fr-text-mention--grey">Suivez vos résidences coup de coeur et tenez à jour vos candidatures</span>
      </div>
      <div
        className={clsx(styles.summaryContainer, 'fr-flex fr-direction-column fr-justify-content-center fr-align-items-center fr-py-3w')}
      >
        <StudentFavorites />
        <div>
          <Button priority="secondary" linkProps={{ href: '/trouver-un-logement-etudiant' }}>
            Explorer les résidences
          </Button>
        </div>
      </div>
    </>
  )
}
