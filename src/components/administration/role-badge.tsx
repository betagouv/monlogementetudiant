import Badge from '@codegouvfr/react-dsfr/Badge'

const roleBadgeConfig: Record<string, { label: string; severity: 'error' | 'info' | 'success' | 'new' }> = {
  admin: { label: 'Admin', severity: 'error' },
  owner: { label: 'Bailleur', severity: 'info' },
  user: { label: 'Etudiant', severity: 'success' },
}

export const RoleBadge = ({ role }: { role: string }) => {
  const config = roleBadgeConfig[role] ?? { label: role, severity: 'new' as const }
  return <Badge severity={config.severity}>{config.label}</Badge>
}
