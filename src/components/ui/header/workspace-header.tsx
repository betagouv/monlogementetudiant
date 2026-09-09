import { notFound } from 'next/navigation'
import { FC } from 'react'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { hasPermission, isBailleurAdministrator, type PermissionCheckUser } from '~/server/bailleur/permissions'
import { getServerSession } from '~/services/better-auth'
import { WorkspaceHeaderClient } from './workspace-header-client'

export const WorkspaceHeaderComponent: FC = async () => {
  const auth = await getServerSession()

  if (!auth || !auth.session || !auth.user) {
    return notFound()
  }

  const isAdmin = auth.user.role === 'admin'
  const adminOwners = auth.user.adminOwners ?? []
  const showSwitcher = isAdmin && adminOwners.length > 1
  const defaultOwnerId = auth.user.owner?.id ?? adminOwners[0]?.id

  const checkUser: PermissionCheckUser = {
    role: auth.user.role,
    bailleurRole: auth.user.bailleurRole ?? null,
    bailleurPermissions: auth.user.bailleurPermissions ?? [],
  }
  const canManageUsers = isBailleurAdministrator(checkUser)
  const canManageResidences = hasPermission(checkUser, 'manage_residences')
  const canManageApplications = hasPermission(checkUser, 'manage_applications')

  return (
    <WorkspaceHeaderClient
      user={auth.user}
      adminOwners={adminOwners}
      defaultOwnerId={defaultOwnerId}
      showSwitcher={showSwitcher}
      contactMode={auth.user.owner?.contactMode ?? EOwnerContactMode.NONE}
      canManageUsers={canManageUsers}
      canManageResidences={canManageResidences}
      canManageApplications={canManageApplications}
      isAdmin={isAdmin}
    />
  )
}
