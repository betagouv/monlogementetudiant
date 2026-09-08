import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { countBailleurAdministrators } from '~/server/bailleur/administrator-limit'
import { getBailleurContext } from '~/server/bailleur/get-bailleur-context'
import { canEditOwnAccount, canGrantAdministratorRights } from '~/server/bailleur/permissions'
import { buildHref } from '~/utils/preserve-query-params'
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
  if (!ctx.hasPermission('manage_users')) redirect(buildHref('/bailleur/tableau-de-bord', awaitedSearchParams))

  // Un gestionnaire ne gere pas son propre compte : seul un administrateur peut s'editer.
  if (awaitedParams.id === ctx.session.user.id && !canEditOwnAccount(ctx.user)) {
    redirect(buildHref('/bailleur/utilisateurs', awaitedSearchParams))
  }

  const t = await getTranslations('bailleur.users')
  const canGrantAdmin = canGrantAdministratorRights(ctx.user)
  const otherAdministratorCount = await countBailleurAdministrators(ctx.owner.id, awaitedParams.id)

  return (
    <div className="fr-container fr-pb-12w">
      <Breadcrumb
        currentPageLabel={<>{t('editUser')}</>}
        segments={[
          { label: t('breadcrumbDashboard'), linkProps: { href: buildHref('/bailleur/tableau-de-bord', awaitedSearchParams) } },
          { label: t('pageTitle'), linkProps: { href: buildHref('/bailleur/utilisateurs', awaitedSearchParams) } },
        ]}
        classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
      />
      <h1>{t('editUser')}</h1>
      <div className="fr-card fr-card--no-border fr-p-3w">
        <EditBailleurUserForm
          id={awaitedParams.id}
          ownerId={ctx.owner.id}
          canGrantAdministratorRights={canGrantAdmin}
          otherAdministratorCount={otherAdministratorCount}
        />
      </div>
    </div>
  )
}
