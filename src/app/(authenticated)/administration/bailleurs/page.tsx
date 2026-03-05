'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'
import { useState } from 'react'
import { AdminDataTable } from '~/components/administration/admin-data-table'
import { useAdminOwners } from '~/hooks/use-admin-owners'

type OwnerRow = {
  id: number
  name: string
  slug: string
  url: string | null
  accommodationCount: number
  userCount: number
}

const columns: ColumnDef<OwnerRow, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Nom',
    cell: ({ row }) => (
      <Link href={`/administration/bailleurs/${row.original.id}`} className="fr-link">
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: 'slug',
    header: 'Slug',
  },
  {
    accessorKey: 'accommodationCount',
    header: 'Residences',
  },
  {
    accessorKey: 'userCount',
    header: 'Utilisateurs',
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <Button priority="tertiary no outline" size="small" linkProps={{ href: `/administration/bailleurs/${row.original.id}` }}>
        Voir
      </Button>
    ),
  },
]

export default function OwnersPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useAdminOwners({
    page,
    search: search || undefined,
  })

  return (
    <>
      <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-mb-3w">
        <h1 className="fr-h3 fr-mb-0">Bailleurs</h1>
        <Button iconId="fr-icon-add-line" linkProps={{ href: '/administration/bailleurs/nouveau' }}>
          Nouveau bailleur
        </Button>
      </div>

      <div className="fr-grid-row fr-grid-row--gutters fr-mb-2w">
        <div className="fr-col-md-6">
          <Input
            label="Rechercher"
            nativeInputProps={{
              placeholder: 'Nom du bailleur...',
              value: search,
              onChange: (e) => {
                setSearch(e.target.value)
                setPage(1)
              },
            }}
          />
        </div>
      </div>

      <AdminDataTable
        columns={columns}
        data={data?.items ?? []}
        pageCount={data?.pageCount ?? 0}
        page={page}
        onPageChange={setPage}
        isLoading={isLoading}
      />
    </>
  )
}
