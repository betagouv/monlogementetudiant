import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import Community from '@codegouvfr/react-dsfr/picto/Community'
import { HydrationBoundary } from '@tanstack/react-query'
import { getTranslations } from 'next-intl/server'
import { ModerationSettingsForm } from '~/components/bailleur/contacts/moderation/moderation-settings-form'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { buildHref } from '~/utils/preserve-query-params'
import { getModerationPageContext } from './get-moderation-page-context'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = {
  ownerId?: string
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function ModerationSettingsPage({ searchParams }: PageProps) {
  const awaitedSearchParams = await searchParams
  const [t, { dehydratedState, ctx }] = await Promise.all([
    getTranslations('bailleur.contacts'),
    getModerationPageContext(awaitedSearchParams),
  ])

  const contactsLabel =
    ctx.owner.contactMode === EOwnerContactMode.DOSSIER_FACILE ? t('breadcrumbContactsDossierFacile') : t('breadcrumbContacts')

  return (
    <HydrationBoundary state={dehydratedState}>
      <div className="fr-container fr-pb-12w">
        <Breadcrumb
          currentPageLabel={t('moderation.pageTitle')}
          segments={[
            { label: t('breadcrumbDashboard'), linkProps: { href: buildHref('/bailleur/tableau-de-bord', awaitedSearchParams) } },
            { label: contactsLabel, linkProps: { href: buildHref('/bailleur/contacts', awaitedSearchParams) } },
          ]}
          classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
        />

        <div className="fr-flex fr-align-items-center fr-flex-gap-4v fr-mb-4w">
          <Community width={72} height={72} />
          <h1 className="fr-mb-0">{t('moderation.pageTitle')}</h1>
        </div>

        <div className="fr-card fr-card--no-border fr-p-3w">
          <h2 className="fr-h5 fr-mb-1v">{t('moderation.subtitle')}</h2>
          <p className="fr-text--sm fr-text-mention--grey fr-mb-4w">{t('moderation.hint')}</p>
          <ModerationSettingsForm
            ownerId={ctx.owner.id}
            ownerContactMode={ctx.owner.contactMode}
            canGrantAdministratorRights={ctx.canGrantAdministratorRights}
          />
        </div>
      </div>
    </HydrationBoundary>
  )
}
