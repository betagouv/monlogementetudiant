'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import Button from '@codegouvfr/react-dsfr/Button'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { Tabs } from '@codegouvfr/react-dsfr/Tabs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import dynamic from 'next/dynamic'
import { OwnerForm, OwnerFormData } from '~/components/administration/owner-form'
import { RoleBadge } from '~/components/administration/role-badge'
import { createToast } from '~/components/ui/createToast'
import { useAdminDeleteOwner } from '~/hooks/use-admin-delete-owner'
import { useAdminOwner } from '~/hooks/use-admin-owner'
import { useAdminUpdateOwner } from '~/hooks/use-admin-update-owner'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'
import styles from '../../administration.module.css'

const OwnerMapTab = dynamic<{
  accommodations: Array<{
    id: number
    name: string
    city: string
    available: boolean
    nbTotalApartments: number | null
    nbAvailableApartments: number
    lat: number | null
    lng: number | null
  }>
}>(() => import('./owner-map-tab').then((m) => m.OwnerMapTab), {
  ssr: false,
  loading: () => <p className="fr-text--sm fr-text-mention--grey">Chargement de la carte...</p>,
})

const deleteOwnerModal = createModal({
  id: 'delete-owner-modal',
  isOpenedByDefault: false,
})

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function OwnerDetail({ id }: { id: string }) {
  const ownerId = Number(id)
  const { data: ownerData, isLoading } = useAdminOwner(ownerId)
  const updateOwner = useAdminUpdateOwner()
  const deleteOwner = useAdminDeleteOwner()

  const trpc = useTRPC()
  const { data: accommodationsData } = useQuery(trpc.admin.owners.accommodations.queryOptions({ ownerId }))
  const { data: statsData } = useQuery(trpc.admin.owners.stats.queryOptions({ ownerId }))

  if (isLoading) return <p>Chargement...</p>
  if (!ownerData) return <p>Gestionnaire non trouvé</p>

  const handleSubmit = (data: OwnerFormData) => {
    updateOwner.mutate({ id: ownerId, name: data.name, url: data.url || null })
  }

  const handleDelete = () => {
    deleteOwner.mutate(ownerId)
  }

  const userCount = ownerData.users?.length ?? 0
  const accCount = accommodationsData?.length ?? 0

  return (
    <>
      <Breadcrumb
        currentPageLabel={ownerData.name}
        segments={[{ label: 'Gestionnaires', linkProps: { href: '/administration/bailleurs' } }]}
        classes={{ root: 'fr-mb-2w' }}
      />

      <div className={clsx(styles.card, 'fr-mb-3w')}>
        <div className={styles.gestionnaireHeader}>
          <div className={styles.gestionnaireAvatar}>{getInitials(ownerData.name)}</div>
          <div className={styles.gestionnaireInfo}>
            <h2>{ownerData.name}</h2>
            <div className={styles.gestionnaireOrg}>
              {ownerData.slug} {ownerData.url && `— ${ownerData.url}`}
            </div>
            <div className={styles.gestionnaireMeta}>
              <span>
                <span className="fr-icon-home-4-line fr-icon--sm" aria-hidden="true" />
                {accCount} résidences
              </span>
              <span>
                <span className="fr-icon-user-line fr-icon--sm" aria-hidden="true" />
                {userCount} utilisateurs
              </span>
            </div>
          </div>
          <div className="fr-ml-auto">
            <Badge severity="success">Actif</Badge>
          </div>
        </div>
        <div className={styles.kpiRow}>
          <div className={styles.kpiItem}>
            <div className={styles.kpiValue}>{accCount}</div>
            <div className={styles.kpiLabel}>Résidences</div>
          </div>
          <div className={styles.kpiItem}>
            <div className={styles.kpiValue}>{userCount}</div>
            <div className={styles.kpiLabel}>Utilisateurs rattachés</div>
          </div>
          <div className={styles.kpiItem}>
            <div className={styles.kpiValue}>{(accommodationsData ?? []).reduce((sum, a) => sum + (a.nbAvailableApartments ?? 0), 0)}</div>
            <div className={styles.kpiLabel}>Disponibles</div>
          </div>
        </div>
      </div>

      <Tabs
        tabs={[
          {
            label: `Utilisateurs (${userCount})`,
            iconId: 'fr-icon-user-line',
            content: <UsersTab users={ownerData.users ?? []} ownerId={ownerId} />,
          },
          {
            label: `Résidences (${accCount})`,
            iconId: 'fr-icon-home-4-line',
            content: <ResidencesTab accommodations={accommodationsData ?? []} />,
          },
          {
            label: 'Statistiques',
            iconId: 'fr-icon-bar-chart-box-line',
            content: <StatsTab stats={statsData ?? null} />,
          },
          {
            label: 'Carte',
            iconId: 'fr-icon-map-pin-2-line',
            content: <OwnerMapTab accommodations={accommodationsData ?? []} />,
          },
          {
            label: 'Informations',
            iconId: 'fr-icon-edit-line',
            content: (
              <div className="fr-grid-row fr-grid-row--gutters">
                <div className="fr-col-md-8">
                  <OwnerForm
                    defaultValues={{
                      name: ownerData.name,
                      url: ownerData.url ?? '',
                    }}
                    onSubmit={handleSubmit}
                    isPending={updateOwner.isPending}
                    submitLabel="Mettre à jour"
                  />
                </div>
                <div className="fr-col-md-4">
                  <div className={styles.dangerZone}>
                    <h3 className={clsx('fr-h6 fr-mb-2w', styles.dangerZoneTitle)}>Zone de danger</h3>
                    <Button priority="tertiary" onClick={() => deleteOwnerModal.open()} disabled={deleteOwner.isPending}>
                      Supprimer le gestionnaire
                    </Button>
                  </div>
                </div>
              </div>
            ),
          },
        ]}
      />

      <deleteOwnerModal.Component
        title="Confirmer la suppression"
        buttons={[
          {
            children: 'Annuler',
            doClosesModal: true,
          },
          {
            children: 'Supprimer',
            onClick: handleDelete,
            doClosesModal: true,
          },
        ]}
      >
        Êtes-vous sûr de vouloir supprimer ce gestionnaire ? Cette action est irréversible.
      </deleteOwnerModal.Component>
    </>
  )
}

function UsersTab({
  users,
  ownerId,
}: {
  users: Array<{ id: string; email: string; firstname: string; lastname: string; role: string }>
  ownerId: number
}) {
  const queryClient = useQueryClient()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()

  const unlinkMutation = useMutation({
    mutationFn: (userId: string) => trpcClient.admin.users.unlinkFromOwner.mutate({ userId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: trpc.admin.owners.getById.queryKey({ id: ownerId }) })
      createToast({ priority: 'success', message: 'Utilisateur délié du gestionnaire' })
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || 'Erreur lors de la déliaison' })
    },
  })

  if (users.length === 0) {
    return <p className="fr-text--sm fr-text-mention--grey">Aucun utilisateur rattaché</p>
  }

  return (
    <div className={clsx('fr-table', styles.tableWrapper)}>
      <table>
        <thead>
          <tr>
            <th scope="col">Utilisateur</th>
            <th scope="col">Rôle</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <div className="fr-text--bold">
                  {u.firstname} {u.lastname}
                </div>
                <div className="fr-text--xs fr-text-mention--grey">{u.email}</div>
              </td>
              <td>
                <RoleBadge role={u.role} />
              </td>
              <td>
                <div className="fr-flex fr-flex-gap-1v">
                  <Button priority="tertiary no outline" size="small" linkProps={{ href: `/administration/utilisateurs/${u.id}` }}>
                    Voir
                  </Button>
                  <Button
                    priority="tertiary no outline"
                    size="small"
                    onClick={() => {
                      if (window.confirm(`Délier ${u.firstname} ${u.lastname} de ce gestionnaire ?`)) {
                        unlinkMutation.mutate(u.id)
                      }
                    }}
                    disabled={unlinkMutation.isPending}
                  >
                    Délier
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ResidencesTab({
  accommodations,
}: {
  accommodations: Array<{
    id: number
    name: string
    city: string
    nbTotalApartments: number | null
    nbAvailableApartments: number
    available: boolean
    published: boolean
  }>
}) {
  if (accommodations.length === 0) {
    return <p className="fr-text--sm fr-text-mention--grey">Aucune résidence</p>
  }

  return (
    <div className={clsx('fr-table', styles.tableWrapper)}>
      <table>
        <thead>
          <tr>
            <th scope="col">Résidence</th>
            <th scope="col">Ville</th>
            <th scope="col">Logements</th>
            <th scope="col">Dispo.</th>
            <th scope="col">Statut</th>
          </tr>
        </thead>
        <tbody>
          {accommodations.map((acc) => (
            <tr key={acc.id}>
              <td className="fr-text--bold">{acc.name}</td>
              <td>{acc.city}</td>
              <td>{acc.nbTotalApartments ?? '-'}</td>
              <td>
                {acc.nbAvailableApartments} / {acc.nbTotalApartments ?? '-'}
              </td>
              <td>{acc.published ? <Badge severity="success">Publiée</Badge> : <Badge severity="warning">Dépubliée</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type StatsData = {
  nbT1: number
  nbT1Bis: number
  nbT2: number
  nbT3: number
  nbT4: number
  nbT5: number
  nbT6: number
  nbT7More: number
  nbColiving: number
}

const TYPE_LABELS: Array<{ key: keyof StatsData; label: string; color: string }> = [
  { key: 'nbT1', label: 'Studio T1', color: 'var(--background-action-high-blue-france)' },
  { key: 'nbT1Bis', label: 'Studio T1 Bis', color: 'var(--background-action-high-blue-france)' },
  { key: 'nbT2', label: 'T2', color: 'var(--background-action-high-blue-france)' },
  { key: 'nbT3', label: 'T3', color: 'var(--background-action-high-blue-france)' },
  { key: 'nbT4', label: 'T4', color: 'var(--background-action-high-blue-france)' },
  { key: 'nbT5', label: 'T5', color: 'var(--background-action-high-blue-france)' },
  { key: 'nbT6', label: 'T6', color: 'var(--background-action-high-blue-france)' },
  { key: 'nbT7More', label: 'T7+', color: 'var(--background-action-high-blue-france)' },
  { key: 'nbColiving', label: 'Colocation', color: 'var(--background-flat-warning)' },
]

function StatsTab({ stats }: { stats: StatsData | null }) {
  if (!stats) return <p className="fr-text--sm fr-text-mention--grey">Chargement...</p>

  const maxValue = Math.max(...TYPE_LABELS.map((t) => stats[t.key]), 1)

  return (
    <div className={clsx(styles.card)} style={{ padding: '1.5rem' }}>
      <h3 className="fr-h6 fr-mb-3w">Répartition par type</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {TYPE_LABELS.filter((t) => stats[t.key] > 0).map((t) => (
          <div key={t.key}>
            <div className="fr-flex fr-justify-content-between fr-mb-1v">
              <span className="fr-mb-0 fr-text--sm">{t.label}</span>
              <span className="fr-mb-0 fr-text--sm fr-text--bold">&nbsp;{stats[t.key]} logements</span>
            </div>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${(stats[t.key] / maxValue) * 100}%`,
                  background: t.color,
                }}
              />
            </div>
          </div>
        ))}
        {TYPE_LABELS.every((t) => stats[t.key] === 0) && <p className="fr-text--sm fr-text-mention--grey">Aucune donnée de répartition</p>}
      </div>
    </div>
  )
}
