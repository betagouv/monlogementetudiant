import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import { Ecosystem } from '@codegouvfr/react-dsfr/picto'
import { HydrationBoundary } from '@tanstack/react-query'
import { getTranslations } from 'next-intl/server'
import { ContactReceptionSettingsForm } from '~/components/bailleur/contacts/reception-settings/contact-reception-settings-form'
import { ContactsEngagementNotice } from '~/components/bailleur/contacts/reception-settings/contacts-engagement-notice'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { buildHref } from '~/utils/preserve-query-params'
import { getContactReceptionPageContext } from './get-contact-reception-page-context'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = {
  ownerId?: string
}

type PageProps = {
  searchParams: Promise<SearchParams>
}

export default async function ContactReceptionSettingsPage({ searchParams }: PageProps) {
  const awaitedSearchParams = await searchParams
  const [t, { dehydratedState, ctx }] = await Promise.all([
    getTranslations('bailleur.contacts'),
    getContactReceptionPageContext(awaitedSearchParams),
  ])

  const isDossierFacile = ctx.owner.contactMode === EOwnerContactMode.DOSSIER_FACILE
  const contactsLabel = isDossierFacile ? t('breadcrumbContactsDossierFacile') : t('breadcrumbContacts')
  const pageTitle = isDossierFacile ? t('receptionSettings.pageTitleDossierFacile') : t('receptionSettings.pageTitle')

  return (
    <HydrationBoundary state={dehydratedState}>
      <div className="fr-container fr-pb-12w">
        <Breadcrumb
          currentPageLabel={pageTitle}
          segments={[
            { label: t('breadcrumbDashboard'), linkProps: { href: buildHref('/bailleur/tableau-de-bord', awaitedSearchParams) } },
            { label: contactsLabel, linkProps: { href: buildHref('/bailleur/contacts', awaitedSearchParams) } },
          ]}
          classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
        />

        <div className="fr-flex fr-align-items-center fr-flex-gap-4v fr-mb-4w">
          <Ecosystem width={72} height={72} color="blue-cumulus" />
          <h1 className="fr-mb-0">{pageTitle}</h1>
        </div>

        {ctx.owner.contactMode === EOwnerContactMode.CONTACTS && <ContactsEngagementNotice ownerId={ctx.owner.id} />}

        <div className="fr-card fr-card--no-border fr-p-3w fr-p-md-6w">
          <h2 className="fr-h4 fr-mb-4w">
            {isDossierFacile ? t('receptionSettings.subtitleDossierFacile') : t('receptionSettings.subtitle')}
          </h2>
          <ContactReceptionSettingsForm ownerId={ctx.owner.id} />
        </div>
      </div>
    </HydrationBoundary>
  )
}
