'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import Select from '@codegouvfr/react-dsfr/Select'
import { ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { AdminDataTable } from '~/components/administration/admin-data-table'
import { RoleBadge } from '~/components/administration/role-badge'
import { useAdminUsers } from '~/hooks/use-admin-users'

type UserRow = {
  id: string
  email: string
  name: string
  firstname: string
  lastname: string
  role: string
  ownerId: number | null
  createdAt: Date
}

const columns: ColumnDef<UserRow, unknown>[] = [
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => (
      <Link href={`/administration/utilisateurs/${row.original.id}`} className="fr-link">
        {row.original.email}
      </Link>
    ),
  },
  {
    accessorKey: 'firstname',
    header: 'Prenom',
  },
  {
    accessorKey: 'lastname',
    header: 'Nom',
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => <RoleBadge role={row.original.role} />,
  },
  {
    id: 'owner',
    header: 'Bailleur',
    cell: ({ row }) => (row.original.ownerId ? `#${row.original.ownerId}` : '-'),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <Button priority="tertiary no outline" size="small" linkProps={{ href: `/administration/utilisateurs/${row.original.id}` }}>
        Voir
      </Button>
    ),
  },
]

export default function UsersPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const roleParam = searchParams.get('role') as 'admin' | 'owner' | 'user' | null
  const pageParam = Number(searchParams.get('page')) || 1

  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [role, setRole] = useState<string>(roleParam ?? '')
  const [page, setPage] = useState(pageParam)

  const { data, isLoading } = useAdminUsers({
    page,
    role: (role as 'admin' | 'owner' | 'user') || undefined,
    search: search || undefined,
  })

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    const params = new URLSearchParams()
    if (role) params.set('role', role)
    if (search) params.set('search', search)
    params.set('page', String(newPage))
    router.push(`/administration/utilisateurs?${params.toString()}`)
  }

  const title = useMemo(() => {
    if (role === 'user') return 'Comptes etudiants'
    if (role === 'owner') return 'Comptes bailleurs'
    if (role === 'admin') return 'Administrateurs'
    return 'Utilisateurs'
  }, [role])

  return (
    <>
      <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-mb-3w">
        <h1 className="fr-h3 fr-mb-0">{title}</h1>
        <Button iconId="fr-icon-add-line" linkProps={{ href: '/administration/utilisateurs/nouveau' }}>
          Nouvel utilisateur
        </Button>
      </div>

      <div className="fr-grid-row fr-grid-row--gutters fr-mb-2w">
        <div className="fr-col-md-6">
          <Input
            label="Rechercher"
            nativeInputProps={{
              placeholder: 'Email, nom, prenom...',
              value: search,
              onChange: (e) => {
                setSearch(e.target.value)
                setPage(1)
              },
            }}
          />
        </div>
        <div className="fr-col-md-3">
          <Select
            label="Role"
            nativeSelectProps={{
              value: role,
              onChange: (e) => {
                setRole(e.target.value)
                setPage(1)
              },
            }}
          >
            <option value="">Tous</option>
            <option value="user">Etudiant</option>
            <option value="owner">Bailleur</option>
            <option value="admin">Admin</option>
          </Select>
        </div>
      </div>

      <AdminDataTable
        columns={columns}
        data={data?.items ?? []}
        pageCount={data?.pageCount ?? 0}
        page={page}
        onPageChange={handlePageChange}
        isLoading={isLoading}
      />
    </>
  )
}
