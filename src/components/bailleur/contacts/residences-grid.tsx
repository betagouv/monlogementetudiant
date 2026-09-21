'use client'

import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import { Avatar } from '@codegouvfr/react-dsfr/picto'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { parseAsString, useQueryState } from 'nuqs'
import { useDebounce } from 'use-debounce'
import { SearchInput } from '~/components/ui/search-input'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { useTRPC } from '~/server/trpc/client'
import { buildHref } from '~/utils/preserve-query-params'
import { ContactModeSettingsModal, contactModeSettingsModal } from './contact-mode-settings-modal'
import { ResidenceContactCard } from './residence-contact-card'

interface Props {
  mode: Exclude<EOwnerContactMode, EOwnerContactMode.NONE>
  /** Modération et changement du mode de contact (qui vaut pour tout le bailleur) : administrateurs seulement. */
  isAdministrator: boolean
  resolvedOwnerId: number
}

export const ResidencesGrid = ({ mode, isAdministrator, resolvedOwnerId }: Props) => {
  const t = useTranslations('bailleur.contacts')
  const trpc = useTRPC()
  const searchParams = useSearchParams()
  const ownerId = searchParams.get('ownerId') ? Number(searchParams.get('ownerId')) : undefined

  const [recherche, setRecherche] = useQueryState('recherche', parseAsString.withDefault(''))
  const [debounced] = useDebounce(recherche, 300)

  const { data } = useQuery(
    trpc.bailleur.listResidencesWithContactCounts.queryOptions({
      search: debounced && debounced.length >= 2 ? debounced : undefined,
      ownerId,
    }),
  )

  const { data: users } = useQuery({
    ...trpc.bailleur.users.list.queryOptions({ ownerId: resolvedOwnerId }),
    enabled: isAdministrator,
  })
  const noManagerCanSeeApplications =
    users !== undefined &&
    !users.items.some((u) => u.bailleurRole === 'gestionnaire' && u.bailleurPermissions.includes('manage_applications'))

  const residences = data?.residences ?? []
  const title = mode === EOwnerContactMode.DOSSIER_FACILE ? t('titleDossierFacile') : t('title')

  return (
    <>
      <div className="fr-flex fr-direction-column fr-direction-md-row fr-align-items-md-center fr-justify-content-md-space-between fr-flex-gap-4v fr-mb-4w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-3v">
          <Avatar width={72} height={72} color="blue-ecume" />
          <h1 className="fr-mb-0">{title}</h1>
        </div>
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <SearchInput label={t('searchResidenceLabel')} value={recherche} onChange={(value) => setRecherche(value || null)} />
          {isAdministrator && (
            <>
              <Button
                linkProps={{ href: buildHref('/bailleur/contacts/moderation', searchParams) }}
                priority="secondary"
                iconId="ri-team-line"
                title={t('moderationButtonTitle')}
              />
              <Button
                {...contactModeSettingsModal.buttonProps}
                priority="secondary"
                iconId="ri-settings-3-line"
                title={t('settingsButtonTitle')}
              />
            </>
          )}
        </div>
      </div>

      {noManagerCanSeeApplications && (
        <Alert
          className="fr-mb-4w"
          severity="info"
          title={t('noManagerAlert.title')}
          description={
            <>
              <p className="fr-mb-2w">
                {t.rich('noManagerAlert.description', {
                  icon: () => <span className="ri-team-line fr-icon--sm" aria-hidden="true" />,
                })}
              </p>
              <Button
                size="small"
                priority="secondary"
                iconId="ri-team-line"
                linkProps={{ href: buildHref('/bailleur/contacts/moderation', searchParams) }}
              >
                {t('noManagerAlert.action')}
              </Button>
            </>
          }
        />
      )}

      {residences.length === 0 ? (
        <p className="fr-py-8w fr-text--center fr-text-mention--grey">{t('noResidence')}</p>
      ) : (
        <div className="fr-grid-row fr-grid-row--gutters">
          {residences.map((r) => (
            <div key={r.id} className="fr-col-12 fr-col-sm-6 fr-col-lg-3">
              <ResidenceContactCard
                slug={r.slug}
                name={r.name}
                cityName={r.cityName}
                departmentCode={r.departmentCode}
                aRappelerCount={r.aRappelerCount}
                applicationsSuspended={r.applicationsSuspended}
              />
            </div>
          ))}
        </div>
      )}

      {isAdministrator && <ContactModeSettingsModal currentMode={mode} ownerId={ownerId} resolvedOwnerId={resolvedOwnerId} />}
    </>
  )
}
