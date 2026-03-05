'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { OwnerForm, OwnerFormData } from '~/components/administration/owner-form'
import { RoleBadge } from '~/components/administration/role-badge'
import { useAdminDeleteOwner } from '~/hooks/use-admin-delete-owner'
import { useAdminOwner } from '~/hooks/use-admin-owner'
import { useAdminUpdateOwner } from '~/hooks/use-admin-update-owner'
import { useTRPC } from '~/server/trpc/client'

export default function OwnerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const ownerId = Number(id)
  const { data: ownerData, isLoading } = useAdminOwner(ownerId)
  const updateOwner = useAdminUpdateOwner()
  const deleteOwner = useAdminDeleteOwner()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const trpc = useTRPC()
  const { data: accommodationsData } = useQuery(trpc.admin.owners.accommodations.queryOptions({ ownerId }))

  if (isLoading) return <p>Chargement...</p>
  if (!ownerData) return <p>Bailleur non trouve</p>

  const handleSubmit = (data: OwnerFormData) => {
    updateOwner.mutate({ id: ownerId, name: data.name, url: data.url || null })
  }

  const handleDelete = () => {
    if (confirmDelete) {
      deleteOwner.mutate(ownerId)
    } else {
      setConfirmDelete(true)
    }
  }

  return (
    <>
      <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-mb-3w">
        <h1 className="fr-h3 fr-mb-0">{ownerData.name}</h1>
        <Button priority="tertiary" iconId="fr-icon-arrow-left-line" linkProps={{ href: '/administration/bailleurs' }}>
          Retour
        </Button>
      </div>

      <div className="fr-grid-row fr-grid-row--gutters">
        <div className="fr-col-md-8">
          <div className="fr-card fr-card--no-border fr-p-3w fr-mb-3w">
            <h2 className="fr-h5 fr-mb-2w">Informations</h2>
            <OwnerForm
              defaultValues={{
                name: ownerData.name,
                url: ownerData.url ?? '',
              }}
              onSubmit={handleSubmit}
              isPending={updateOwner.isPending}
              submitLabel="Mettre a jour"
            />
          </div>

          <div className="fr-card fr-card--no-border fr-p-3w">
            <h2 className="fr-h5 fr-mb-2w">Residences ({accommodationsData?.length ?? 0})</h2>
            {accommodationsData && accommodationsData.length > 0 ? (
              <div className="fr-table">
                <table>
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Ville</th>
                      <th>Logements</th>
                      <th>Disponible</th>
                      <th>Publie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accommodationsData.map((acc) => (
                      <tr key={acc.id}>
                        <td>{acc.name}</td>
                        <td>{acc.city}</td>
                        <td>{acc.nbTotalApartments ?? '-'}</td>
                        <td>{acc.available ? 'Oui' : 'Non'}</td>
                        <td>{acc.published ? 'Oui' : 'Non'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="fr-text--sm fr-text-mention--grey">Aucune residence</p>
            )}
          </div>
        </div>

        <div className="fr-col-md-4">
          <div className="fr-card fr-card--no-border fr-p-3w fr-mb-3w">
            <h2 className="fr-h5 fr-mb-2w">Utilisateurs lies</h2>
            {ownerData.users && ownerData.users.length > 0 ? (
              <ul className="fr-raw-list">
                {ownerData.users.map((u) => (
                  <li key={u.id} className="fr-mb-1w fr-flex fr-align-items-center fr-flex-gap-1v">
                    <Link href={`/administration/utilisateurs/${u.id}`} className="fr-link">
                      {u.firstname} {u.lastname}
                    </Link>
                    <RoleBadge role={u.role} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="fr-text--sm fr-text-mention--grey">Aucun utilisateur lie</p>
            )}
          </div>

          <div className="fr-card fr-card--no-border fr-p-3w">
            <h2 className="fr-h5 fr-mb-2w">Zone de danger</h2>
            <Button
              priority={confirmDelete ? 'primary' : 'tertiary'}
              onClick={handleDelete}
              disabled={deleteOwner.isPending}
              style={confirmDelete ? { backgroundColor: 'var(--background-flat-error)' } : undefined}
            >
              {confirmDelete ? 'Confirmer la suppression' : 'Supprimer le bailleur'}
            </Button>
            {confirmDelete && (
              <Button priority="tertiary" size="small" className="fr-ml-1w" onClick={() => setConfirmDelete(false)}>
                Annuler
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
