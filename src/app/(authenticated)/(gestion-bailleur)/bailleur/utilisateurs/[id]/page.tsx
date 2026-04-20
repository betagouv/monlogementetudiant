import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getBailleurContext } from '~/server/bailleur/get-bailleur-context'
import { canGrantAdministratorRights } from '~/server/bailleur/permissions'
import { EditBailleurUserForm } from './edit-bailleur-user-form'

export default async function EditBailleurUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ownerId?: string }>
}) {
  const awaitedParams = await params
  const awaitedSearchParams = await searchParams
  const ctx = await getBailleurContext(awaitedSearchParams.ownerId)
  if (!ctx.hasPermission('manage_users')) redirect('/bailleur/tableau-de-bord')

  const t = await getTranslations('bailleur.users')
  const canGrantAdmin = canGrantAdministratorRights(ctx.user)

  return (
    <div className="fr-container fr-pb-12w">
      <Breadcrumb
        currentPageLabel={<>{t('editUser')}</>}
        segments={[
          { label: t('breadcrumbDashboard'), linkProps: { href: '/bailleur/tableau-de-bord' } },
          { label: t('pageTitle'), linkProps: { href: '/bailleur/utilisateurs' } },
        ]}
        classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
      />
      <h1>{t('editUser')}</h1>
      <div className="fr-card fr-card--no-border fr-p-3w">
        <EditBailleurUserForm id={awaitedParams.id} ownerId={ctx.owner.id} canGrantAdministratorRights={canGrantAdmin} />
      </div>
    </div>
  )
}
