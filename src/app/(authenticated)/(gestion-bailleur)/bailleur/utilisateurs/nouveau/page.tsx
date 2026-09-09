import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { countBailleurAdministrators } from '~/server/bailleur/administrator-limit'
import { getBailleurContext } from '~/server/bailleur/get-bailleur-context'
import { canGrantAdministratorRights, isBailleurAdministrator } from '~/server/bailleur/permissions'
import { buildHref } from '~/utils/preserve-query-params'
import { NewBailleurUserForm } from './new-bailleur-user-form'

export default async function NewBailleurUserPage({ searchParams }: { searchParams: Promise<{ ownerId?: string }> }) {
  const awaited = await searchParams
  const ctx = await getBailleurContext(awaited.ownerId)
  if (!isBailleurAdministrator(ctx.user)) redirect(buildHref('/bailleur/tableau-de-bord', awaited))

  const t = await getTranslations('bailleur.users')
  const canGrantAdmin = canGrantAdministratorRights(ctx.user)
  const administratorCount = await countBailleurAdministrators(ctx.owner.id)

  return (
    <div className="fr-container fr-pb-12w">
      <Breadcrumb
        currentPageLabel={<>{t('newUser')}</>}
        segments={[
          { label: t('breadcrumbDashboard'), linkProps: { href: buildHref('/bailleur/tableau-de-bord', awaited) } },
          { label: t('pageTitle'), linkProps: { href: buildHref('/bailleur/utilisateurs', awaited) } },
        ]}
        classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
      />
      <h1>{t('addUser')}</h1>
      <div className="fr-card fr-card--no-border fr-p-3w">
        <NewBailleurUserForm
          ownerId={ctx.owner.id}
          canGrantAdministratorRights={canGrantAdmin}
          administratorCount={administratorCount}
          ownerContactMode={ctx.owner.contactMode}
        />
      </div>
    </div>
  )
}
