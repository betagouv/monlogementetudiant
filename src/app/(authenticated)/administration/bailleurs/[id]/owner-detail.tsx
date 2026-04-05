'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import Button from '@codegouvfr/react-dsfr/Button'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { Tabs } from '@codegouvfr/react-dsfr/Tabs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useState } from 'react'
import { LinkAdminToOwnerDialog } from '~/components/administration/link-admin-to-owner-dialog'
import { LinkUserToOwnerDialog } from '~/components/administration/link-user-to-owner-dialog'
import { OwnerForm } from '~/components/administration/owner-form'
import { OwnerLogoForm } from '~/components/administration/owner-logo-form'
import { RoleBadge } from '~/components/administration/role-badge'
import { createToast } from '~/components/ui/createToast'
import { useAdminDeleteOwner } from '~/hooks/use-admin-delete-owner'
import { useAdminOwner } from '~/hooks/use-admin-owner'
import { useAdminUpdateOwner } from '~/hooks/use-admin-update-owner'
import { TOwnerFormData } from '~/schemas/owner-form'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'
import { getFaviconUrl } from '~/utils/get-favicon-url'
import { sPluriel } from '~/utils/sPluriel'
import styles from '../../administration.module.css'

const OwnerMapTab = dynamic<{
  accommodations: Array<{
    id: number
    name: string
    slug: string
    city: string
    citySlug: string | null
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

function OwnerDetailAvatar({ name, url, imageBase64 }: { name: string; url: string | null; imageBase64: string | null }) {
  const [faviconError, setFaviconError] = useState(false)
  const [dbImageError, setDbImageError] = useState(false)
  const faviconUrl = url ? getFaviconUrl(url) : null

  if (imageBase64 && !dbImageError) {
    return (
      <div className={styles.gestionnaireAvatar} style={{ background: '#fff', overflow: 'hidden' }}>
        <Image src={imageBase64} alt={name} width={40} height={40} onError={() => setDbImageError(true)} unoptimized />
      </div>
    )
  }

  if (faviconUrl && !faviconError) {
    return (
      <div className={styles.gestionnaireAvatar} style={{ background: '#fff', overflow: 'hidden' }}>
        <Image src={faviconUrl} alt={name} width={40} height={40} onError={() => setFaviconError(true)} unoptimized />
      </div>
    )
  }

  return <div className={styles.gestionnaireAvatar}>{getInitials(name)}</div>
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

  const handleSubmit = async (data: TOwnerFormData) => {
    await updateOwner.mutateAsync({
      id: ownerId,
      name: data.name,
      url: data.url || undefined,
      acceptDossierFacileApplications: data.acceptDossierFacileApplications,
    })
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
          <OwnerDetailAvatar name={ownerData.name} url={ownerData.url} imageBase64={ownerData.imageBase64} />
          <div className={styles.gestionnaireInfo}>
            <h2>{ownerData.name}</h2>
            <div className={styles.gestionnaireOrg}>
              {ownerData.slug} {ownerData.url && `— ${ownerData.url}`}
            </div>
            <div className={styles.gestionnaireMeta}>
              <span>
                <span className="fr-icon-home-4-line fr-icon--sm" aria-hidden="true" />
                {accCount} résidence{sPluriel(accCount)}
              </span>
              <span>
                <span className="fr-icon-user-line fr-icon--sm" aria-hidden="true" />
                {userCount} utilisateur{sPluriel(userCount)}
              </span>
            </div>
          </div>
        </div>
        <div className={styles.kpiRow}>
          <div className={styles.kpiItem}>
            <div className={styles.kpiValue}>{accCount}</div>
            <div className={styles.kpiLabel}>Résidence{sPluriel(accCount)}</div>
          </div>
          <div className={styles.kpiItem}>
            <div className={styles.kpiValue}>{userCount}</div>
            <div className={styles.kpiLabel}>
              Utilisateur{sPluriel(userCount)} rattaché{sPluriel(userCount)}
            </div>
          </div>
          <div className={styles.kpiItem}>
            <div className={styles.kpiValue}>{(accommodationsData ?? []).reduce((sum, a) => sum + (a.nbAvailableApartments ?? 0), 0)}</div>
            <div className={styles.kpiLabel}>
              Disponible{sPluriel((accommodationsData ?? []).reduce((sum, a) => sum + (a.nbAvailableApartments ?? 0), 0))}
            </div>
          </div>
        </div>
      </div>

      <Tabs
        tabs={[
          {
            label: `Utilisateur${sPluriel(userCount)} (${userCount})`,
            iconId: 'fr-icon-user-line',
            content: (
              <UsersTab
                users={ownerData.users ?? []}
                adminUsers={(ownerData.adminOwnerLinks ?? []).map((link) => link.user)}
                ownerId={ownerId}
                ownerName={ownerData.name}
              />
            ),
          },
          {
            label: `Résidence${sPluriel(accCount)} (${accCount})`,
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
                  <OwnerLogoForm ownerId={ownerId} imageBase64={ownerData.imageBase64} />
                  <OwnerForm
                    defaultValues={{
                      name: ownerData.name,
                      url: ownerData.url ?? '',
                      acceptDossierFacileApplications: ownerData.acceptDossierFacileApplications,
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
  adminUsers,
  ownerId,
  ownerName,
}: {
  users: Array<{ id: string; email: string; firstname: string; lastname: string; role: string }>
  adminUsers: Array<{ id: string; email: string; firstname: string; lastname: string; role: string }>
  ownerId: number
  ownerName: string
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

  const unlinkAdminMutation = useMutation({
    mutationFn: (userId: string) => trpcClient.admin.users.unlinkAdminFromOwner.mutate({ userId, ownerId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.admin.owners.getById.queryKey({ id: ownerId }) }),
        queryClient.invalidateQueries({ queryKey: trpc.admin.users.myLinkedOwners.queryKey() }),
      ])
      createToast({ priority: 'success', message: 'Administrateur délié du gestionnaire' })
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || 'Erreur lors de la déliaison' })
    },
  })

  return (
    <>
      <div className="fr-flex fr-justify-content-end fr-mb-2w fr-flex-gap-2v">
        <LinkAdminToOwnerDialog ownerId={ownerId} ownerName={ownerName} />
        <LinkUserToOwnerDialog ownerId={ownerId} ownerName={ownerName} />
      </div>

      {adminUsers.length > 0 && (
        <>
          <h3 className="fr-h6 fr-mb-2w">Administrateurs liés</h3>
          <div className={clsx('fr-table fr-mb-3w', styles.tableWrapper)}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Administrateur</th>
                  <th scope="col">Rôle</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map((u) => (
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
                          onClick={() => unlinkAdminMutation.mutate(u.id)}
                          disabled={unlinkAdminMutation.isPending}
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
        </>
      )}

      <h3 className="fr-h6 fr-mb-2w">Utilisateurs rattachés</h3>
      {users.length === 0 ? (
        <p className="fr-text--sm fr-text-mention--grey">Aucun utilisateur rattaché</p>
      ) : (
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
                        onClick={() => unlinkMutation.mutate(u.id)}
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
      )}
    </>
  )
}

function ResidencesTab({
  accommodations,
}: {
  accommodations: Array<{
    id: number
    name: string
    slug: string
    city: string
    citySlug: string | null
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
            <th scope="col">Actions</th>
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
              <td>
                <div className="fr-flex fr-flex-gap-1v">
                  <Button
                    priority="tertiary"
                    size="small"
                    linkProps={{ href: `/trouver-un-logement-etudiant/ville/${acc.citySlug}/${acc.slug}`, target: '_blank' }}
                  >
                    Voir
                  </Button>
                  <Button priority="tertiary" size="small" linkProps={{ href: `/bailleur/residences/${acc.slug}` }}>
                    Modifier
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
              <span className="fr-mb-0 fr-text--sm fr-text--bold">
                &nbsp;{stats[t.key]} logement{sPluriel(stats[t.key])}
              </span>
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
