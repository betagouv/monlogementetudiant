import Button from '@codegouvfr/react-dsfr/Button'
import LocationFrance from '@codegouvfr/react-dsfr/picto/LocationFrance'
import Money from '@codegouvfr/react-dsfr/picto/Money'
import Notification from '@codegouvfr/react-dsfr/picto/Notification'
import Success from '@codegouvfr/react-dsfr/picto/Success'
import clsx from 'clsx'
import styles from './student-todo-list.module.css'

export const StudentTodoList = () => {
  const itemsTodo = [
    {
      label: 'Simuler mes aides au logement',
      description: 'Tout pour estimer vos droits',
      pictogram: <Money width={48} height={48} />,
      cta: (
        <Button size="small" priority="secondary" linkProps={{ href: '/simuler-budget', target: '_blank' }}>
          Accéder au simulateur
        </Button>
      ),
      duration: '5 minutes',
    },
    {
      label: 'Anticiper mon budget étudiant',
      description: "Pour les villes où je pourrais m'installer",
      pictogram: <LocationFrance width={48} height={48} />,
      cta: (
        <Button size="small" priority="secondary" linkProps={{ href: '/preparer-mon-budget-etudiant', target: '_blank' }}>
          Guide pratique
        </Button>
      ),
      duration: '5 minutes',
    },
    // {
    //   label: 'Compléter votre dossier de location sur DossierFacile',
    //   description: 'Tous les documents nécessaires pour candidater',
    //   pictogram: <Binders />,
    // },
    {
      label: 'Déposer un dossier dans au moins 3 résidences étudiantes',
      description: 'Mettez toutes les chances de votre côté',
      pictogram: <Success width={48} height={48} />,
      cta: (
        <Button size="small" priority="secondary" linkProps={{ href: '/trouver-un-logement-etudiant', target: '_blank' }}>
          Explorer les logements
        </Button>
      ),
    },
  ]

  const itemsDone = [
    {
      label: 'Créer sa première alerte logement',
      description: 'Les nouvelles offres de logements disponibles en temps réel',
      pictogram: <Notification width={48} height={48} />,
      cta: (
        <Button size="small" priority="secondary" linkProps={{ href: '/mon-espace/alertes' }}>
          Mes alertes
        </Button>
      ),
      duration: '1 minute',
    },
  ]

  const renderSection = (title: string, items: typeof itemsTodo, borderStyle: string) => (
    <div className="fr-flex fr-direction-column">
      <span className="fr-text--lg fr-text-title--grey fr-text--bold">{title}</span>
      <div className="fr-flex fr-direction-column fr-flex-gap-6v">
        {items.map((item, index) => (
          <div
            key={index}
            className={clsx(styles.container, borderStyle, 'fr-flex fr-direction-column fr-background-default--grey fr-p-3w')}
          >
            {item.pictogram}
            <span className="fr-h6 fr-mb-0">{item.label}</span>
            {item.description}
            <span className="fr-text--xs fr-mb-0 fr-hidden-sm">{item.duration}</span>
            <div className="fr-flex fr-mt-2w fr-align-items-center fr-justify-content-space-between">
              {item.cta} <span className="fr-text--xs fr-mb-0 fr-hidden fr-unhidden-md">{item.duration}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <>
      {renderSection('À faire', itemsTodo, styles.itemToDoBorder)}
      {renderSection('Terminé', itemsDone, styles.itemDoneBorder)}
    </>
  )
}
