import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getBailleurContext } from '~/server/bailleur/get-bailleur-context'
import { canGrantAdministratorRights } from '~/server/bailleur/permissions'
import { NewBailleurUserForm } from './new-bailleur-user-form'

export default async function NewBailleurUserPage({ searchParams }: { searchParams: Promise<{ ownerId?: string }> }) {
  const awaited = await searchParams
  const ctx = await getBailleurContext(awaited.ownerId)
  if (!ctx.hasPermission('manage_users')) redirect('/bailleur/tableau-de-bord')

  const t = await getTranslations('bailleur.users')
  const canGrantAdmin = canGrantAdministratorRights(ctx.user)

  return (
    <div className="fr-container fr-pb-12w">
      <Breadcrumb
        currentPageLabel={<>{t('newUser')}</>}
        segments={[
          { label: t('breadcrumbDashboard'), linkProps: { href: '/bailleur/tableau-de-bord' } },
          { label: t('pageTitle'), linkProps: { href: '/bailleur/utilisateurs' } },
        ]}
        classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
      />
      <h1>{t('addUser')}</h1>
      <div className="fr-card fr-card--no-border fr-p-3w">
        <NewBailleurUserForm ownerId={ctx.owner.id} canGrantAdministratorRights={canGrantAdmin} />
      </div>
    </div>
  )
}
