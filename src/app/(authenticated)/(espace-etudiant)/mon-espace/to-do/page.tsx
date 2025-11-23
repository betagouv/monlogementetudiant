import clsx from 'clsx'
import { auth } from '~/auth'
import { StudentTodoList } from '~/components/student-space/todo/student-todo-list'
import styles from '../mon-espace.module.css'

export default async function EtudiantTableauDeBordPage() {
  const session = await auth()

  if (!session) {
    // return notFound()
  }

  return (
    <>
      <div className="fr-border-right fr-border-top fr-border-bottom fr-px-6w fr-py-5w">
        <h1>Ma to-do list</h1>
        <span className="fr-text--xl fr-text-mention--grey">Complétez votre to-do list pour mettre toutes les chances de votre côté</span>
      </div>
      <div
        className={clsx(
          styles.summaryContainer,
          'fr-width-full fr-flex fr-direction-column fr-direction-md-row fr-flex-gap-4v fr-justify-content-space-between fr-px-3w fr-pt-3w fr-px-md-6w fr-pt-md-3w fr-pb-6w',
        )}
      >
        <StudentTodoList />
      </div>
    </>
  )
}
