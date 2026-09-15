import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import { Ecosystem } from '@codegouvfr/react-dsfr/picto'
import { HydrationBoundary } from '@tanstack/react-query'
import { getTranslations } from 'next-intl/server'
import { buildHref } from '~/utils/preserve-query-params'
import { getUsersPageContext } from './get-users-page-context'
import { UsersList } from './users-list'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = {
  recherche?: string
  ownerId?: string
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function BailleurUsersPage({ searchParams }: PageProps) {
  const awaitedSearchParams = await searchParams
  const { dehydratedState, ctx } = await getUsersPageContext(awaitedSearchParams)
  const t = await getTranslations('bailleur.users')

  return (
    <HydrationBoundary state={dehydratedState}>
      <div className="fr-container fr-pb-12w">
        <Breadcrumb
          currentPageLabel={<>{t('pageTitle')}</>}
          segments={[{ label: t('breadcrumbDashboard'), linkProps: { href: buildHref('/bailleur/tableau-de-bord', awaitedSearchParams) } }]}
          classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
        />

        <div className="fr-flex fr-justify-content-space-between fr-align-items-center">
          <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-width-full">
            <div className="fr-flex fr-align-items-center fr-flex-gap-4v fr-mb-4w">
              <Ecosystem width={72} height={72} color="blue-ecume" />
              <h1 className="fr-mb-0">{t('pageTitle')}</h1>
            </div>
          </div>
        </div>
        <UsersList
          currentUserId={ctx.session.user.id}
          currentUserIsAdministrator={ctx.canEditOwnAccount}
          ownerId={ctx.owner.id}
          ownerContactMode={ctx.owner.contactMode}
          canGrantAdministratorRights={ctx.canGrantAdministratorRights}
        />
      </div>
    </HydrationBoundary>
  )
}
