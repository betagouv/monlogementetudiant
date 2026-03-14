'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { ColumnDef } from '@tanstack/react-table'
import clsx from 'clsx'
import Link from 'next/link'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { useDebounce } from 'use-debounce'
import { AdminDataTable } from '~/components/administration/admin-data-table'
import { useAdminUsers } from '~/hooks/use-admin-users'
import { formatDateTime } from '~/utils/formatDate'
import { sPluriel } from '~/utils/sPluriel'
import styles from '../administration.module.css'

type OwnerAccountRow = {
  id: string
  email: string
  name: string
  firstname: string
  lastname: string
  createdAt: Date
  lastLoginAt: Date | null
  ownerId: number | null
  ownerName: string | null
}

const columns: ColumnDef<OwnerAccountRow, unknown>[] = [
  {
    accessorKey: 'email',
    header: 'Gestionnaire',
    enableSorting: true,
    cell: ({ row }) => (
      <div>
        <Link href={`/administration/utilisateurs/${row.original.id}`} className="fr-link fr-text--bold">
          {row.original.firstname} {row.original.lastname}
        </Link>
        <div className="fr-text--xs fr-text-mention--grey">{row.original.email}</div>
      </div>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Inscription',
    enableSorting: true,
    cell: ({ row }) => formatDateTime(row.original.createdAt),
  },
  {
    accessorKey: 'lastLoginAt',
    header: 'Dernière connexion',
    enableSorting: true,
    cell: ({ row }) => (row.original.lastLoginAt ? formatDateTime(row.original.lastLoginAt) : '-'),
  },
  {
    accessorKey: 'ownerName',
    header: 'Bailleur',
    enableSorting: true,
    cell: ({ row }) => row.original.ownerName ?? 'Non rattaché',
  },
  {
    id: 'actions',
    header: '',
    enableSorting: false,
    cell: ({ row }) => (
      <Button priority="tertiary no outline" size="small" linkProps={{ href: `/administration/utilisateurs/${row.original.id}` }}>
        Voir
      </Button>
    ),
  },
]

export function OwnerAccountsList() {
  const [{ search, page }, setQueryStates] = useQueryStates({
    search: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
  })
  const [debouncedSearch] = useDebounce(search, 300)

  const { data, isLoading } = useAdminUsers({
    page,
    search: debouncedSearch.length >= 2 ? debouncedSearch : undefined,
    role: 'owner',
  })

  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <div className={styles.pageIcon}>
            <span className={clsx(styles.pageIconBadge, 'fr-icon-account-circle-line')} aria-hidden="true" />
          </div>
          <h1 className="fr-h3 fr-mb-0">Comptes gestionnaires</h1>
        </div>
        <p className="fr-text--sm fr-text-mention--grey fr-mt-1v">
          {data?.total ?? 0} compte{sPluriel(data?.total ?? 0)} gestionnaire{sPluriel(data?.total ?? 0)} sur la plateforme
        </p>
      </div>

      <div className="fr-grid-row fr-grid-row--gutters fr-mb-2w fr-align-items-end">
        <div className="fr-col-md-5">
          <Input
            label="Rechercher"
            nativeInputProps={{
              placeholder: 'Email, nom, prénom...',
              value: search,
              onChange: (e) => {
                setQueryStates({ search: e.target.value, page: 1 })
              },
            }}
          />
        </div>
        <div className="fr-col-md-7 fr-flex fr-justify-content-end">
          <Button iconId="fr-icon-add-line" linkProps={{ href: '/administration/utilisateurs/nouveau' }}>
            Nouvel utilisateur
          </Button>
        </div>
      </div>

      <AdminDataTable
        columns={columns}
        data={data?.items ?? []}
        pageCount={data?.pageCount ?? 0}
        page={page}
        onPageChange={(p) => setQueryStates({ page: p })}
        isLoading={isLoading}
      />
    </>
  )
}
