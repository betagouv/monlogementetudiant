'use client'

import { Header } from '@codegouvfr/react-dsfr/Header'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { BrandTop } from '~/components/ui/brand-top'
import type { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { TUser } from '~/lib/types'
import { buildHref } from '~/utils/preserve-query-params'
import { OwnerSwitcher } from './owner-switcher'
import { UserConnectedDropdown } from './user-connected-dropdown'
import { WorkspaceHeaderNavigation } from './workspace-navigation'

type OwnerOption = { id: number; name: string; slug: string; contactMode?: EOwnerContactMode }

type WorkspaceHeaderClientProps = {
  user: TUser
  adminOwners: OwnerOption[]
  defaultOwnerId?: number
  showSwitcher: boolean
  contactMode: EOwnerContactMode
  canManageUsers: boolean
  canManageResidences: boolean
  canManageApplications: boolean
  isAdmin: boolean
}

export function WorkspaceHeaderClient({
  user,
  adminOwners,
  defaultOwnerId,
  showSwitcher,
  contactMode,
  canManageUsers,
  canManageResidences,
  canManageApplications,
  isAdmin,
}: WorkspaceHeaderClientProps) {
  const t = useTranslations()
  const searchParams = useSearchParams()
  const dashboardHref = buildHref('/bailleur/tableau-de-bord', searchParams)
  const currentOwnerId = searchParams.get('ownerId') ?? defaultOwnerId?.toString()
  const selectedOwner = currentOwnerId ? adminOwners.find((owner) => owner.id === Number(currentOwnerId)) : null
  const selectedContactMode = selectedOwner?.contactMode ?? contactMode

  return (
    <div>
      <Header
        homeLinkProps={{
          href: dashboardHref,
          title: t('metadata.workspace.title'),
        }}
        quickAccessItems={[
          ...(showSwitcher ? [<OwnerSwitcher key="owner-switcher" owners={adminOwners} defaultOwnerId={defaultOwnerId} />] : []),
          <UserConnectedDropdown key="user-connected-dropdown" user={user} />,
        ]}
        brandTop={<BrandTop />}
        serviceTagline={t('header.description')}
        serviceTitle={
          <>
            {t('header.title')}
            <span className="fr-ml-1w fr-badge fr-badge--new fr-badge--no-icon fr-text--uppercase">{t('bailleur.header.title')}</span>
          </>
        }
        navigation={
          <WorkspaceHeaderNavigation
            contactMode={selectedContactMode}
            canManageUsers={canManageUsers}
            canManageResidences={canManageResidences}
            canManageApplications={canManageApplications}
            isAdmin={isAdmin}
          />
        }
        className="fr-header"
      />
    </div>
  )
}
