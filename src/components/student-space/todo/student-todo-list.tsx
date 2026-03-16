'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import LocationFrance from '@codegouvfr/react-dsfr/picto/LocationFrance'
import Money from '@codegouvfr/react-dsfr/picto/Money'
import Notification from '@codegouvfr/react-dsfr/picto/Notification'
import Success from '@codegouvfr/react-dsfr/picto/Success'
import clsx from 'clsx'
import { useLocalStorage } from 'usehooks-ts'
import { trackEvent } from '~/lib/tracking'
import styles from './student-todo-list.module.css'

export const ALL_TODOS = [
  {
    id: 'simulate-housing-aid',
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
    id: 'anticipate-student-budget',
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
  {
    id: 'submit-applications',
    label: 'Déposer un dossier dans au moins 3 résidences étudiantes',
    description: 'Mettez toutes les chances de votre côté',
    pictogram: <Success width={48} height={48} />,
    cta: (
      <Button size="small" priority="secondary" linkProps={{ href: '/trouver-un-logement-etudiant', target: '_blank' }}>
        Explorer les logements
      </Button>
    ),
  },
  {
    id: 'create-housing-alert',
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

export const StudentTodoList = () => {
  const [completedTodos, setCompletedTodos] = useLocalStorage<string[]>('student-completed-todos', [])

  const itemsTodo = ALL_TODOS.filter((todo) => !completedTodos.includes(todo.id))
  const itemsDone = ALL_TODOS.filter((todo) => completedTodos.includes(todo.id))

  const markAsCompleted = (todoId: string) => {
    if (!completedTodos.includes(todoId)) {
      trackEvent({ category: 'Espace Etudiant', action: 'todo fait', name: todoId })
      setCompletedTodos((prev) => [...prev, todoId])
    }
  }

  const markAsTodo = (todoId: string) => {
    trackEvent({ category: 'Espace Etudiant', action: 'todo remis', name: todoId })
    setCompletedTodos((prev) => prev.filter((id) => id !== todoId))
  }

  const renderSection = (title: string, items: typeof itemsTodo, borderStyle: string, action?: 'complete' | 'undo') => (
    <div className="fr-flex fr-direction-column">
      <span className="fr-text--lg fr-text-title--grey fr-text--bold">{title}</span>
      <div className="fr-flex fr-direction-column fr-flex-gap-6v">
        {items.map((item) => (
          <div
            key={item.id}
            className={clsx(styles.container, borderStyle, 'fr-flex fr-direction-column fr-background-default--grey fr-p-3w')}
          >
            <div className="fr-flex fr-align-items-center fr-justify-content-space-between">
              {item.pictogram}
              {action === 'complete' && (
                <Button title="Terminé" size="small" priority="tertiary" iconId="ri-check-line" onClick={() => markAsCompleted(item.id)} />
              )}
              {action === 'undo' && (
                <Button
                  title="Remettre à faire"
                  size="small"
                  priority="tertiary"
                  iconId="ri-arrow-go-back-line"
                  onClick={() => markAsTodo(item.id)}
                />
              )}
            </div>
            <span className="fr-h6 fr-mb-0">{item.label}</span>
            {item.description}
            <span className="fr-text--xs fr-mb-0 fr-hidden-sm">{item.duration}</span>
            <div className="fr-flex fr-mt-2w fr-align-items-center fr-justify-content-space-between">
              <div className="fr-flex fr-flex-gap-2v">{item.cta}</div>
              <span className="fr-text--xs fr-mb-0 fr-hidden fr-unhidden-md">{item.duration}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <>
      {renderSection('À faire', itemsTodo, styles.itemToDoBorder, 'complete')}
      {renderSection('Terminé', itemsDone, styles.itemDoneBorder, 'undo')}
    </>
  )
}
