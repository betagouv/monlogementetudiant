import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import { Avatar } from '@codegouvfr/react-dsfr/picto'
import { HydrationBoundary } from '@tanstack/react-query'
import { getTranslations } from 'next-intl/server'
import { ContactsLanding } from '~/components/bailleur/contacts/contacts-landing'
import { ResidencesGrid } from '~/components/bailleur/contacts/residences-grid'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { buildHref } from '~/utils/preserve-query-params'
import { getContactsPageContext } from './get-contacts-page-context'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = {
  recherche?: string
  ownerId?: string
}

type ContactsPageProps = {
  searchParams: Promise<SearchParams>
}

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const awaitedSearchParams = await searchParams
  const [t, { dehydratedState, ctx }] = await Promise.all([
    getTranslations('bailleur.contacts'),
    getContactsPageContext(awaitedSearchParams),
  ])
  const mode = ctx.owner.contactMode

  return (
    <HydrationBoundary state={dehydratedState}>
      <div className="fr-container fr-pb-12w">
        <Breadcrumb
          currentPageLabel={t('breadcrumbContacts')}
          segments={[{ label: t('breadcrumbDashboard'), linkProps: { href: buildHref('/bailleur/tableau-de-bord', awaitedSearchParams) } }]}
          classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
        />

        {mode === EOwnerContactMode.NONE ? (
          <>
            <div className="fr-flex fr-align-items-center fr-flex-gap-4v fr-mb-4w">
              <Avatar width={72} height={72} color="blue-ecume" />
              <h1 className="fr-mb-0">{t('title')}</h1>
            </div>
            <ContactsLanding />
          </>
        ) : (
          <ResidencesGrid mode={mode} canManageModeration={ctx.isAdministrator} resolvedOwnerId={ctx.owner.id} />
        )}
      </div>
    </HydrationBoundary>
  )
}
