import { Alert } from '@codegouvfr/react-dsfr/Alert'
import clsx from 'clsx'
import styles from '../administration.module.css'

export default function CandidaturesPage() {
  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <div className={styles.pageIcon}>
            <span className={clsx(styles.pageIconBadge, 'fr-icon-file-text-line')} aria-hidden="true" />
          </div>
          <h1 className="fr-h3 fr-mb-0">Candidatures</h1>
        </div>
      </div>

      <Alert
        severity="info"
        title="Section en cours de développement"
        description="La gestion des candidatures sera disponible prochainement."
        className="fr-mb-3w"
      />
    </>
  )
}
