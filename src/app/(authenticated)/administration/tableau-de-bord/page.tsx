'use client'

import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import Image from 'next/image'
import { useState } from 'react'
import { Cell, Label, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { useDebounce } from 'use-debounce'
import dialogStyles from '~/components/administration/link-dialog.module.css'
import { createToast } from '~/components/ui/createToast'
import { useAdminMyLinkedOwners } from '~/hooks/use-admin-my-linked-owners'
import { useAdminStats } from '~/hooks/use-admin-stats'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'
import { authClient } from '~/services/better-auth-client'
import { getAvatarColor, getInitials } from '~/utils/avatar'
import { getFaviconUrl } from '~/utils/get-favicon-url'
import { sPluriel } from '~/utils/sPluriel'
import styles from '../administration.module.css'
import dashboardStyles from './tableau-de-bord.module.css'

export default function DashboardPage() {
  const { data, isLoading } = useAdminStats()

  const students = data?.users.students ?? 0
  const accommodations = data?.accommodations ?? 0
  const availableAccommodations = data?.availableAccommodations ?? 0
  const owners = data?.owners ?? 0

  const statCards = [
    {
      label: `Étudiant${sPluriel(students)} inscrit${sPluriel(students)}`,
      value: students,
      icon: 'fr-icon-user-line',
      colorClass: styles.statCardBlue,
    },
    {
      label: `Résidence${sPluriel(accommodations)}`,
      value: accommodations,
      icon: 'fr-icon-home-4-line',
      colorClass: styles.statCardGreen,
    },
    {
      label: `Logement${sPluriel(availableAccommodations)} disponible${sPluriel(availableAccommodations)}`,
      value: availableAccommodations,
      icon: 'fr-icon-checkbox-circle-line',
      colorClass: styles.statCardOrange,
    },
    {
      label: `Gestionnaire${sPluriel(owners)}`,
      value: owners,
      icon: 'fr-icon-building-line',
      colorClass: styles.statCardPurple,
    },
  ]

  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <div className={styles.pageIcon}>
            <span className={clsx(styles.pageIconBadge, 'fr-icon-dashboard-3-line')} aria-hidden="true" />
          </div>
          <h1 className="fr-h3 fr-mb-0">Tableau de bord</h1>
        </div>
        <p className="fr-text--sm fr-text-mention--grey fr-mt-1v">Vue d&apos;ensemble de la plateforme Mon Logement Etudiant</p>
      </div>

      <div className={clsx(styles.statsGrid, 'fr-mb-3w')}>
        {statCards.map((card) => (
          <div key={card.label} className={clsx(styles.statCard, card.colorClass)}>
            <div className={styles.statLabel}>{card.label}</div>
            <div className={clsx(styles.statValue, 'fr-mt-1v')}>{isLoading ? '-' : card.value}</div>
            <span className={clsx(card.icon, styles.statIcon)} aria-hidden="true" />
          </div>
        ))}
      </div>

      <MyLinkedOwners />

      <div className={clsx(styles.grid2, 'fr-mb-3w')}>
        <RoleBreakdown data={data} />
        <OccupationChart data={data} />
      </div>

      <div className={clsx(styles.grid2, 'fr-mb-3w')}>
        <RecentActivity />
      </div>
    </>
  )
}

const linkSelfToOwnerModal = createModal({
  id: 'link-self-to-owner-modal',
  isOpenedByDefault: false,
})

function MyLinkedOwners() {
  const { data: session } = authClient.useSession()
  const { data: linkedOwners, isLoading } = useAdminMyLinkedOwners()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const queryClient = useQueryClient()

  const unlinkMutation = useMutation({
    mutationFn: (ownerId: number) => trpcClient.admin.users.unlinkAdminFromOwner.mutate({ userId: session!.user.id, ownerId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: trpc.admin.users.myLinkedOwners.queryKey() })
      createToast({ priority: 'success', message: 'Délié du gestionnaire' })
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || 'Erreur lors de la déliaison' })
    },
  })

  return (
    <div className={clsx(styles.card, 'fr-mb-3w')}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>
          <span className="fr-icon-building-line fr-icon--sm fr-mr-1w" aria-hidden="true" />
          Gestionnaire(s) associé(s) à mon compte
        </span>
        <Button iconId="fr-icon-add-line" size="small" priority="secondary" onClick={() => linkSelfToOwnerModal.open()}>
          Se lier à un gestionnaire
        </Button>
      </div>
      <div>
        {isLoading ? (
          <p className="fr-text--sm fr-text-mention--grey fr-p-3w">Chargement...</p>
        ) : !linkedOwners || linkedOwners.length === 0 ? (
          <p className="fr-text--sm fr-text-mention--grey fr-p-3w">Vous n'êtes rattaché à aucun gestionnaire</p>
        ) : (
          linkedOwners.map((owner) => (
            <LinkedOwnerItem
              key={owner.id}
              owner={owner}
              onUnlink={() => unlinkMutation.mutate(owner.id)}
              isUnlinking={unlinkMutation.isPending}
            />
          ))
        )}
      </div>
      {session && <LinkSelfToOwnerDialog userId={session.user.id} />}
    </div>
  )
}

function LinkedOwnerItem({
  owner,
  onUnlink,
  isUnlinking,
}: {
  owner: { id: number; name: string; slug: string; url: string | null; imageBase64: string | null }
  onUnlink: () => void
  isUnlinking: boolean
}) {
  const [imgError, setImgError] = useState(false)
  const faviconUrl = owner.url ? getFaviconUrl(owner.url) : null

  return (
    <div className={styles.linkedOwnerItem}>
      {owner.imageBase64 && !imgError ? (
        <div className={clsx(styles.linkedOwnerAvatar, dashboardStyles.avatarImage)}>
          <Image src={owner.imageBase64} alt={owner.name} width={40} height={40} onError={() => setImgError(true)} unoptimized />
        </div>
      ) : faviconUrl && !imgError ? (
        <div className={clsx(styles.linkedOwnerAvatar, dashboardStyles.avatarImage)}>
          <Image src={faviconUrl} alt={owner.name} width={40} height={40} onError={() => setImgError(true)} unoptimized />
        </div>
      ) : (
        <div className={styles.linkedOwnerAvatar} style={{ background: getAvatarColor(owner.name) }}>
          {getInitials(owner.name)}
        </div>
      )}
      <div className={styles.linkedOwnerInfo}>
        <div className={styles.linkedOwnerName}>{owner.name}</div>
        <div className={styles.linkedOwnerSlug}>{owner.slug}</div>
      </div>
      <div className={styles.linkedOwnerActions}>
        <Button priority="tertiary no outline" size="small" linkProps={{ href: `/administration/bailleurs/${owner.id}` }}>
          Voir
        </Button>
        <Button priority="tertiary no outline" size="small" onClick={onUnlink} disabled={isUnlinking}>
          Délier
        </Button>
      </div>
    </div>
  )
}

function LinkSelfToOwnerDialog({ userId }: { userId: string }) {
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null)
  const [debouncedSearch] = useDebounce(search, 300)

  const { data: ownersList } = useQuery({
    ...trpc.admin.owners.list.queryOptions({ page: 1, search: debouncedSearch }),
    enabled: debouncedSearch.length >= 2,
  })

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOwnerId) return
      await trpcClient.admin.users.linkAdminToOwner.mutate({ userId, ownerId: selectedOwnerId })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: trpc.admin.users.myLinkedOwners.queryKey() })
      createToast({ priority: 'success', message: 'Lié au gestionnaire avec succès' })
      linkSelfToOwnerModal.close()
      resetState()
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || 'Erreur lors de la liaison' })
    },
  })

  const resetState = () => {
    setSearch('')
    setSelectedOwnerId(null)
  }

  const owners = ownersList?.items ?? []

  return (
    <linkSelfToOwnerModal.Component title="Se lier à un gestionnaire" size="large">
      <Input
        label="Rechercher un gestionnaire"
        classes={{ root: 'fr-mb-2w' }}
        nativeInputProps={{
          value: search,
          onChange: (e) => setSearch(e.target.value),
          placeholder: 'Rechercher par nom...',
        }}
      />

      {debouncedSearch.length >= 2 && (
        <div className={dialogStyles.selectorList}>
          {owners.map((o) => {
            const isSelected = selectedOwnerId === o.id
            return (
              <button
                type="button"
                key={o.id}
                onClick={() => setSelectedOwnerId(o.id)}
                className={isSelected ? dialogStyles.selectorItemSelected : dialogStyles.selectorItem}
              >
                <div className={dialogStyles.selectorAvatarSquare} style={{ background: getAvatarColor(o.name) }}>
                  {getInitials(o.name)}
                </div>
                <div className={dialogStyles.selectorInfo}>
                  <div className={dialogStyles.selectorName}>{o.name}</div>
                  <div className={dialogStyles.selectorMeta}>{o.slug}</div>
                </div>
                <div className={isSelected ? dialogStyles.selectorRadioSelected : dialogStyles.selectorRadio} />
              </button>
            )
          })}
          {owners.length === 0 && (
            <p className={clsx('fr-text--sm fr-text-mention--grey', dialogStyles.selectorEmpty)}>Aucun gestionnaire trouvé</p>
          )}
        </div>
      )}

      <div className="fr-flex fr-flex-gap-2v">
        <Button onClick={() => linkMutation.mutate()} disabled={!selectedOwnerId || linkMutation.isPending}>
          {linkMutation.isPending ? 'En cours...' : 'Se lier au gestionnaire sélectionné'}
        </Button>
        <Button priority="secondary" onClick={() => linkSelfToOwnerModal.close()}>
          Annuler
        </Button>
      </div>
    </linkSelfToOwnerModal.Component>
  )
}

function RoleBreakdown({ data }: { data: ReturnType<typeof useAdminStats>['data'] }) {
  if (!data) return null

  const total = data.users.total || 1
  const roles = [
    { label: `Administrateur${sPluriel(data.users.admins)}`, count: data.users.admins, color: 'var(--background-flat-error)' },
    { label: `Gestionnaire${sPluriel(data.users.owners)}`, count: data.users.owners, color: 'var(--background-action-high-blue-france)' },
    { label: `Étudiant${sPluriel(data.users.students)}`, count: data.users.students, color: 'var(--background-flat-success)' },
  ]

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>Répartition par role</span>
      </div>
      <div className="fr-p-3w">
        {roles.map((role) => {
          const pct = Math.round((role.count / total) * 100)
          return (
            <div key={role.label} className="fr-mb-2w">
              <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-mb-1v">
                <span className="fr-text--sm fr-text--bold fr-mb-0">{role.label}</span>
                <span className="fr-text--sm fr-mb-0">
                  {role.count} ({pct}%)
                </span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${pct}%`, background: role.color }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const OCCUPATION_COLORS = ['#000091', '#e8944a', '#1f8d49']

function OccupationChart({ data }: { data: ReturnType<typeof useAdminStats>['data'] }) {
  if (!data?.occupation) return null

  const { total, occupied, available } = data.occupation
  if (total === 0) return null

  const occupiedPct = Math.round((occupied / total) * 1000) / 10

  const chartData = [
    { name: `Occupé${sPluriel(occupied)}`, value: occupied, color: OCCUPATION_COLORS[0] },
    { name: `Disponible${sPluriel(available)}`, value: available, color: OCCUPATION_COLORS[2] },
  ]

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>Occupation des résidences</span>
      </div>
      <div className={clsx('fr-p-3w', dashboardStyles.occupationContent)}>
        <div className={dashboardStyles.occupationChartWrapper}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                innerRadius={55}
                outerRadius={80}
                startAngle={90}
                endAngle={-270}
                paddingAngle={2}
                minAngle={5}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
                <Label
                  position="center"
                  content={() => (
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
                      <tspan x="50%" dy="-0.4em" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                        {occupiedPct}%
                      </tspan>
                      <tspan x="50%" dy="1.4em" style={{ fontSize: '0.75rem', fill: '#666' }}>
                        occupé{sPluriel(occupied)}
                      </tspan>
                    </text>
                  )}
                />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className={dashboardStyles.occupationLegend}>
          {chartData.map((entry) => {
            const pct = Math.round((entry.value / total) * 1000) / 10
            return (
              <div key={entry.name} className={dashboardStyles.occupationLegendItem}>
                <div className={dashboardStyles.occupationLegendDot} style={{ background: entry.color }} />
                <div>
                  <div className="fr-text--sm fr-text--bold fr-mb-0">
                    {entry.value.toLocaleString('fr-FR')} {entry.name.toLowerCase()}
                  </div>
                  <div className="fr-text--xs fr-text-mention--grey">{pct}%</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function RecentActivity() {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>Activité récente</span>
      </div>
      <div className="fr-m-4w">
        <Alert
          severity="info"
          title="Section en cours de développement"
          description="La gestion des activités sera disponible prochainement."
          className="fr-mb-3w"
        />
      </div>
    </div>
  )
}
