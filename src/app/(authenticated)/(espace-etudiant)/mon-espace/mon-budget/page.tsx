import { getTranslations } from 'next-intl/server'
import { SavedBudgetContent } from '~/components/student-space/budget/saved-budget-content'
import { getBudgetSimulation } from '~/server/student/get-budget-simulation'

export const generateMetadata = async () => {
  const t = await getTranslations('breadcrumbs.student')
  return { title: t('budget.title') }
}

export default async function BudgetPage() {
  const t = await getTranslations('student.budget')
  const inputs = await getBudgetSimulation()

  return (
    <>
      <div className="fr-border-right fr-border-top fr-border-bottom fr-px-6w fr-py-5w">
        <h1>{t('title')}</h1>
        <span className="fr-text--xl fr-text-mention--grey">{t('description')}</span>
      </div>
      <SavedBudgetContent initialState={inputs} />
    </>
  )
}
