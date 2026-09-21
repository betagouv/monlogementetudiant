import Badge from '@codegouvfr/react-dsfr/Badge'
import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import Button from '@codegouvfr/react-dsfr/Button'
import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ContactsBoard } from '~/components/bailleur/contacts/contacts-board'
import { ResidenceApplicationsToggle } from '~/components/bailleur/contacts/residence-applications-toggle'
import { CONTACT_RETENTION_DAYS } from '~/enums/contact-status'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { getBailleurContext } from '~/server/bailleur/get-bailleur-context'
import { getQueryClient, trpc } from '~/server/trpc/server'
import { buildHref } from '~/utils/preserve-query-params'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ ownerId?: string }>
}

export default async function ResidenceContactsPage({ params, searchParams }: Props) {
  const { slug } = await params
  const awaitedSearchParams = await searchParams
  const [t, ctx] = await Promise.all([getTranslations('bailleur.contacts'), getBailleurContext(awaitedSearchParams.ownerId)])

  if (!ctx.hasPermission('manage_applications')) redirect(buildHref('/bailleur/tableau-de-bord', awaitedSearchParams))
  if (ctx.owner.contactMode === EOwnerContactMode.NONE) redirect(buildHref('/bailleur/contacts', awaitedSearchParams))

  const queryClient = getQueryClient()
  const data = await queryClient.fetchQuery(trpc.bailleur.listContactsByResidence.queryOptions({ slug })).catch(() => null)

  if (!data) return notFound()

  const { residence } = data

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="fr-container fr-pb-12w">
        <Breadcrumb
          currentPageLabel={t('residenceTitle', { name: residence.name })}
          segments={[
            { label: t('breadcrumbDashboard'), linkProps: { href: buildHref('/bailleur/tableau-de-bord', awaitedSearchParams) } },
            { label: t('breadcrumbContacts'), linkProps: { href: buildHref('/bailleur/contacts', awaitedSearchParams) } },
          ]}
          classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
        />

        <div className="fr-flex fr-align-items-center fr-justify-content-space-between fr-flex-wrap fr-flex-gap-2v fr-mb-1w">
          <h1 className="fr-mb-0 fr-flex fr-align-items-center fr-flex-gap-2v">
            {t('residenceTitle', { name: residence.name })}
            <Badge severity="success" noIcon as="span">
              {t('availabilityCount', { count: residence.disponibilites })}
            </Badge>
          </h1>
          <Button
            priority="secondary"
            iconId="ri-equalizer-line"
            linkProps={{ href: buildHref(`/bailleur/residences/${slug}`, awaitedSearchParams) }}
          >
            {t('editResidence')}
          </Button>
        </div>
        <p className="fr-text-mention--grey fr-mb-2w">{t('retentionNotice', { days: CONTACT_RETENTION_DAYS })}</p>
        <div className="fr-mb-4w">
          <ResidenceApplicationsToggle slug={slug} />
        </div>

        <ContactsBoard slug={slug} />
      </div>
    </HydrationBoundary>
  )
}
