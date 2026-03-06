'use client'

import { Alert } from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import Pagination from '@codegouvfr/react-dsfr/Pagination'
import { SegmentedControl } from '@codegouvfr/react-dsfr/SegmentedControl'
import { ColumnDef } from '@tanstack/react-table'
import clsx from 'clsx'
import Link from 'next/link'
import { useState } from 'react'
import { useDebounce } from 'use-debounce'
import { AdminDataTable } from '~/components/administration/admin-data-table'
import { useAdminOwners } from '~/hooks/use-admin-owners'
import styles from '../administration.module.css'

type OwnerRow = {
  id: number
  name: string
  slug: string
  url: string | null
  accommodationCount: number
  userCount: number
  availableApartments: number
}

const AVATAR_COLORS = ['#e63946', '#2b9348', '#4361ee', '#f4a261', '#7209b7', '#4cc9f0']

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function getColor(index: number) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

const columns: ColumnDef<OwnerRow, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Gestionnaire',
    enableSorting: true,
    cell: ({ row }) => (
      <Link href={`/administration/bailleurs/${row.original.id}`} className="fr-link">
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: 'slug',
    header: 'Slug',
    enableSorting: true,
  },
  {
    accessorKey: 'accommodationCount',
    header: 'Résidences',
    enableSorting: true,
  },
  {
    accessorKey: 'userCount',
    header: 'Utilisateurs',
    enableSorting: true,
  },
  {
    id: 'actions',
    header: '',
    enableSorting: false,
    cell: ({ row }) => (
      <Button priority="tertiary no outline" size="small" linkProps={{ href: `/administration/bailleurs/${row.original.id}` }}>
        Voir la fiche
      </Button>
    ),
  },
]

export default function OwnersPage() {
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [search, setSearch] = useState('')
  const [debouncedSearch] = useDebounce(search, 300)
  const [page, setPage] = useState(1)

  const { data, isLoading, isError, error } = useAdminOwners({
    page,
    search: debouncedSearch.length >= 2 ? debouncedSearch : undefined,
  })

  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <div className={styles.pageIcon}>
            <span className={clsx(styles.pageIconBadge, 'fr-icon-building-line')} aria-hidden="true" />
          </div>
          <h1 className="fr-h3 fr-mb-0">Gestionnaires</h1>
        </div>
        <p className="fr-text--sm fr-text-mention--grey fr-mt-1v">Gérez les gestionnaires de résidences étudiantes</p>
      </div>

      <div className="fr-flex fr-align-items-end fr-flex-gap-2v fr-mb-3w fr-flex-wrap">
        <div className="fr-col-md-4">
          <Input
            label="Rechercher"
            nativeInputProps={{
              placeholder: 'Nom du gestionnaire...',
              value: search,
              onChange: (e) => {
                setSearch(e.target.value)
                setPage(1)
              },
            }}
          />
        </div>
        <div className="fr-ml-auto fr-flex fr-align-items-center fr-flex-gap-2v">
          <SegmentedControl
            hideLegend
            small
            segments={[
              {
                label: 'Vue grille',
                iconId: 'fr-icon-layout-grid-line',
                nativeInputProps: {
                  checked: view === 'grid',
                  onChange: () => setView('grid'),
                },
              },
              {
                label: 'Vue tableau',
                iconId: 'fr-icon-table-line',
                nativeInputProps: {
                  checked: view === 'table',
                  onChange: () => setView('table'),
                },
              },
            ]}
          />
          <Button iconId="fr-icon-add-line" linkProps={{ href: '/administration/bailleurs/nouveau' }}>
            Nouveau Gestionnaire
          </Button>
        </div>
      </div>

      {isError && (
        <Alert
          severity="error"
          title="Erreur de chargement"
          description={error?.message ?? 'Impossible de charger la liste des gestionnaires.'}
          className="fr-mb-3w"
        />
      )}

      {view === 'grid' ? (
        <>
          {isLoading ? (
            <p className="fr-text--sm fr-text-mention--grey">Chargement...</p>
          ) : (data?.items ?? []).length === 0 ? (
            <p className="fr-text--sm fr-text-mention--grey">Aucun bailleur</p>
          ) : (
            <div className={clsx(styles.gestionnaireCards, 'fr-mb-3w')}>
              {data!.items.map((owner, i) => (
                <Link key={owner.id} href={`/administration/bailleurs/${owner.id}`} className={styles.gCard}>
                  <div className={styles.gCardTop}>
                    <div className={styles.gCardAvatar} style={{ background: getColor(i) }}>
                      {getInitials(owner.name)}
                    </div>
                    <div className={styles.flexFill}>
                      <div className={styles.gCardName}>{owner.name}</div>
                      <div className={styles.gCardOrg}>{owner.slug}</div>
                    </div>
                  </div>
                  <div className={styles.gCardStats}>
                    <div>
                      <div className={styles.gCardStatVal}>{owner.accommodationCount}</div>
                      <div className={styles.gCardStatLbl}>Résidences</div>
                    </div>
                    <div>
                      <div className={styles.gCardStatVal}>{owner.userCount}</div>
                      <div className={styles.gCardStatLbl}>Utilisateurs</div>
                    </div>
                    <div>
                      <div className={styles.gCardStatVal}>{owner.availableApartments}</div>
                      <div className={styles.gCardStatLbl}>Disponibles</div>
                    </div>
                  </div>
                  <div className={styles.gCardBottom}>
                    <span>{owner.url ?? '-'}</span>
                  </div>
                </Link>
              ))}
              <Link href="/administration/bailleurs/nouveau" className={styles.gCardAdd}>
                <span className="fr-icon-add-line fr-icon--lg" aria-hidden="true" />
                <span className="fr-text--sm fr-text--bold">Ajouter un gestionnaire</span>
              </Link>
            </div>
          )}
        </>
      ) : (
        <AdminDataTable
          columns={columns}
          data={data?.items ?? []}
          pageCount={data?.pageCount ?? 0}
          page={page}
          onPageChange={setPage}
          isLoading={isLoading}
          isError={isError}
          hidePagination
        />
      )}

      {(data?.pageCount ?? 0) > 1 && (
        <Pagination
          className="fr-flex fr-justify-content-center fr-mt-3w"
          count={data!.pageCount}
          defaultPage={page}
          getPageLinkProps={(pageNumber) => ({
            href: '#',
            onClick: (e) => {
              e.preventDefault()
              setPage(pageNumber)
            },
          })}
        />
      )}
    </>
  )
}
