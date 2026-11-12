'use client'

import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import ToggleSwitch from '@codegouvfr/react-dsfr/ToggleSwitch'
import { ColumnDef } from '@tanstack/react-table'
import clsx from 'clsx'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { useState } from 'react'
import { useDebounce } from 'use-debounce'
import { AdminDataTable } from '~/components/administration/admin-data-table'
import { OwnerPicker, type TPickedOwner } from '~/components/administration/owner-picker'
import { createToast } from '~/components/ui/createToast'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { useAdminConsumerUsage } from '~/hooks/use-admin-consumer-usage'
import { useAdminConsumers } from '~/hooks/use-admin-consumers'
import { useAdminCreateConsumer } from '~/hooks/use-admin-create-consumer'
import { useAdminRevokeConsumer } from '~/hooks/use-admin-revoke-consumer'
import { useAdminUpdateConsumer } from '~/hooks/use-admin-update-consumer'
import { formatDateTime } from '~/utils/formatDate'
import { sPluriel } from '~/utils/sPluriel'
import styles from '../administration.module.css'

type ConsumerRow = {
  id: string
  name: string | null
  prefix: string | null
  start: string | null
  enabled: boolean
  rateLimitEnabled: boolean
  rateLimitMax: number | null
  rateLimitTimeWindow: number | null
  requestCount: number
  remaining: number | null
  lastRequest: Date | string | null
  createdAt: Date | string
  metadata: { contact?: string; description?: string }
  usage30d: number
  owner: { id: number; name: string; contactMode: EOwnerContactMode } | null
}

type FormState = {
  name: string
  contact: string
  description: string
  rateLimitMax: string
  rateLimitWindowSeconds: string
  enabled: boolean
  rateLimitEnabled: boolean
  owner: TPickedOwner | null
}

const emptyForm: FormState = {
  name: '',
  contact: '',
  description: '',
  rateLimitMax: '',
  rateLimitWindowSeconds: '',
  enabled: true,
  rateLimitEnabled: true,
  owner: null,
}

const createConsumerModal = createModal({ id: 'create-consumer-modal', isOpenedByDefault: false })
const editConsumerModal = createModal({ id: 'edit-consumer-modal', isOpenedByDefault: false })
const revokeConsumerModal = createModal({ id: 'revoke-consumer-modal', isOpenedByDefault: false })
const keyRevealModal = createModal({ id: 'reveal-consumer-key-modal', isOpenedByDefault: false })
const statsConsumerModal = createModal({ id: 'stats-consumer-modal', isOpenedByDefault: false })

const toNumberOrUndefined = (value: string): number | undefined => {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const n = Number(trimmed)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined
}

const formatRateLimit = (row: ConsumerRow): string => {
  if (!row.rateLimitEnabled) return 'Désactivé'
  if (row.rateLimitMax == null || row.rateLimitTimeWindow == null) return 'Défaut'
  const seconds = Math.round(row.rateLimitTimeWindow / 1000)
  return `${row.rateLimitMax} req / ${seconds}s`
}

export function ConsumersList() {
  const [{ search, page }, setQueryStates] = useQueryStates({
    search: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
  })
  const [debouncedSearch] = useDebounce(search, 300)

  const { data, isLoading } = useAdminConsumers({
    page,
    search: debouncedSearch.length >= 2 ? debouncedSearch : undefined,
  })

  const createConsumer = useAdminCreateConsumer()
  const updateConsumer = useAdminUpdateConsumer()
  const revokeConsumer = useAdminRevokeConsumer()

  const [form, setForm] = useState<FormState>(emptyForm)
  const [editing, setEditing] = useState<ConsumerRow | null>(null)
  const [revoking, setRevoking] = useState<ConsumerRow | null>(null)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [statsConsumer, setStatsConsumer] = useState<ConsumerRow | null>(null)
  const { data: usage, isLoading: usageLoading } = useAdminConsumerUsage(statsConsumer?.id ?? null)

  const openCreate = () => {
    setForm(emptyForm)
    createConsumerModal.open()
  }

  const openEdit = (row: ConsumerRow) => {
    setEditing(row)
    setForm({
      name: row.name ?? '',
      contact: row.metadata.contact ?? '',
      description: row.metadata.description ?? '',
      rateLimitMax: row.rateLimitMax != null ? String(row.rateLimitMax) : '',
      rateLimitWindowSeconds: row.rateLimitTimeWindow != null ? String(Math.round(row.rateLimitTimeWindow / 1000)) : '',
      enabled: row.enabled,
      rateLimitEnabled: row.rateLimitEnabled,
      owner: row.owner,
    })
    editConsumerModal.open()
  }

  const openRevoke = (row: ConsumerRow) => {
    setRevoking(row)
    revokeConsumerModal.open()
  }

  const openStats = (row: ConsumerRow) => {
    setStatsConsumer(row)
    statsConsumerModal.open()
  }

  const handleCreate = async () => {
    const result = await createConsumer.mutateAsync({
      name: form.name.trim(),
      contact: form.contact.trim() || undefined,
      description: form.description.trim() || undefined,
      rateLimitMax: toNumberOrUndefined(form.rateLimitMax),
      rateLimitWindowSeconds: toNumberOrUndefined(form.rateLimitWindowSeconds),
      ownerId: form.owner?.id,
    })
    createConsumerModal.close()
    setRevealedKey(result.key)
    keyRevealModal.open()
  }

  const handleUpdate = async () => {
    if (!editing) return
    await updateConsumer.mutateAsync({
      keyId: editing.id,
      name: form.name.trim(),
      contact: form.contact.trim(),
      description: form.description.trim(),
      enabled: form.enabled,
      rateLimitEnabled: form.rateLimitEnabled,
      rateLimitMax: toNumberOrUndefined(form.rateLimitMax),
      rateLimitWindowSeconds: toNumberOrUndefined(form.rateLimitWindowSeconds),
      ownerId: form.owner?.id ?? null,
    })
    editConsumerModal.close()
  }

  const copyKey = async () => {
    if (!revealedKey) return
    await navigator.clipboard.writeText(revealedKey)
    createToast({ priority: 'success', message: 'Clé copiée dans le presse-papiers' })
  }

  const columns: ColumnDef<ConsumerRow, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Consommateur',
      enableSorting: true,
      cell: ({ row }) => (
        <div>
          <div className="fr-text--bold">{row.original.name || '—'}</div>
          {row.original.metadata.contact && <div className="fr-text--xs fr-text-mention--grey">{row.original.metadata.contact}</div>}
        </div>
      ),
    },
    {
      id: 'owner',
      header: 'Bailleur',
      enableSorting: false,
      cell: ({ row }) => row.original.owner?.name ?? '—',
    },
    {
      id: 'key',
      header: 'Clé',
      enableSorting: false,
      // `start` contient déjà le début de la clé complète (préfixe inclus) — ne pas re-préfixer.
      cell: ({ row }) => <code className="fr-text--xs">{row.original.start ?? row.original.prefix ?? '••••'}…</code>,
    },
    {
      accessorKey: 'enabled',
      header: 'Statut',
      enableSorting: true,
      cell: ({ row }) => (
        <span className={clsx('fr-badge fr-badge--sm', row.original.enabled ? 'fr-badge--success' : 'fr-badge--error')}>
          {row.original.enabled ? 'Active' : 'Désactivée'}
        </span>
      ),
    },
    {
      id: 'rateLimit',
      header: 'Rate-limit',
      enableSorting: false,
      cell: ({ row }) => formatRateLimit(row.original),
    },
    {
      accessorKey: 'usage30d',
      header: 'Requêtes (30j)',
      enableSorting: true,
      cell: ({ row }) => row.original.usage30d.toLocaleString('fr-FR'),
    },
    {
      accessorKey: 'lastRequest',
      header: 'Dernière requête',
      enableSorting: true,
      cell: ({ row }) => (row.original.lastRequest ? formatDateTime(new Date(row.original.lastRequest)) : '—'),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="fr-flex fr-flex-gap-1v">
          <Button
            priority="tertiary no outline"
            size="small"
            iconId="fr-icon-line-chart-line"
            title="Statistiques"
            onClick={() => openStats(row.original)}
          >
            Stats
          </Button>
          <Button
            priority="tertiary no outline"
            size="small"
            iconId="fr-icon-edit-line"
            title="Modifier"
            onClick={() => openEdit(row.original)}
          >
            Modifier
          </Button>
          <Button
            priority="tertiary no outline"
            size="small"
            iconId="fr-icon-delete-line"
            title="Révoquer"
            onClick={() => openRevoke(row.original)}
          >
            Révoquer
          </Button>
        </div>
      ),
    },
  ]

  const total = data?.total ?? 0

  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <div className={styles.pageIcon}>
            <span className={clsx(styles.pageIconBadge, 'ri-shield-keyhole-line')} aria-hidden="true" />
          </div>
          <h1 className="fr-h3 fr-mb-0">Consommateurs</h1>
        </div>
        <p className="fr-text--sm fr-text-mention--grey fr-mt-1v">
          {total} clé{sPluriel(total)} d'API pour l'API publique v1
        </p>
      </div>

      <div className="fr-grid-row fr-grid-row--gutters fr-mb-2w fr-align-items-end">
        <div className="fr-col-md-5">
          <Input
            label="Rechercher"
            nativeInputProps={{
              placeholder: 'Nom du consommateur...',
              value: search,
              onChange: (e) => setQueryStates({ search: e.target.value, page: 1 }),
            }}
          />
        </div>
        <div className="fr-col-md-7 fr-flex fr-justify-content-end">
          <Button iconId="fr-icon-add-line" onClick={openCreate}>
            Nouveau consommateur
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

      <createConsumerModal.Component
        title="Nouveau consommateur"
        buttons={[
          { children: 'Annuler', doClosesModal: true, priority: 'secondary' },
          { children: 'Créer', doClosesModal: false, onClick: handleCreate, disabled: !form.name.trim() || createConsumer.isPending },
        ]}
      >
        <ConsumerFormFields form={form} setForm={setForm} mode="create" />
      </createConsumerModal.Component>

      <editConsumerModal.Component
        title="Modifier le consommateur"
        buttons={[
          { children: 'Annuler', doClosesModal: true, priority: 'secondary' },
          { children: 'Enregistrer', doClosesModal: false, onClick: handleUpdate, disabled: !form.name.trim() || updateConsumer.isPending },
        ]}
      >
        <ConsumerFormFields form={form} setForm={setForm} mode="edit" />
      </editConsumerModal.Component>

      <revokeConsumerModal.Component
        title="Révoquer la clé"
        buttons={[
          { children: 'Annuler', doClosesModal: true, priority: 'secondary' },
          {
            children: 'Révoquer',
            doClosesModal: true,
            onClick: () => {
              if (revoking) revokeConsumer.mutate(revoking.id)
            },
          },
        ]}
      >
        Êtes-vous sûr de vouloir révoquer la clé de « {revoking?.name || '—'} » ? Cette action est irréversible et coupera immédiatement son
        accès à l'API.
      </revokeConsumerModal.Component>

      <keyRevealModal.Component title="Clé d'API créée" buttons={[{ children: 'Fermer', doClosesModal: true }]}>
        <p className="fr-text--sm">
          Copiez cette clé maintenant : pour des raisons de sécurité, elle ne sera <strong>plus jamais affichée</strong>. Le consommateur
          doit l'envoyer dans l'en-tête <code>x-api-key</code>.
        </p>
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v fr-mb-2w">
          <code className="fr-text--sm" style={{ wordBreak: 'break-all' }}>
            {revealedKey}
          </code>
        </div>
        <Button iconId="fr-icon-clipboard-line" onClick={copyKey}>
          Copier la clé
        </Button>
      </keyRevealModal.Component>

      <statsConsumerModal.Component
        title={`Consommation — ${statsConsumer?.name || '—'}`}
        buttons={[{ children: 'Fermer', doClosesModal: true }]}
      >
        {usageLoading ? (
          <p>Chargement…</p>
        ) : !usage || usage.daily.length === 0 ? (
          <p className="fr-text--sm fr-text-mention--grey">Aucune requête enregistrée sur les 30 derniers jours.</p>
        ) : (
          <>
            <p className="fr-text--sm fr-mb-2w">
              <strong>{usage.total.toLocaleString('fr-FR')}</strong> requête{sPluriel(usage.total)} sur les 30 derniers jours.
            </p>
            <div className="fr-table fr-table--sm" style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Jour</th>
                    <th scope="col">Requêtes</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.daily.map((d) => (
                    <tr key={d.day}>
                      <td>{d.day}</td>
                      <td>{d.count.toLocaleString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </statsConsumerModal.Component>
    </>
  )
}

function ConsumerFormFields({
  form,
  setForm,
  mode,
}: {
  form: FormState
  setForm: (updater: (prev: FormState) => FormState) => void
  mode: 'create' | 'edit'
}) {
  return (
    <>
      <Input
        label="Nom du consommateur"
        nativeInputProps={{
          value: form.name,
          placeholder: 'Ex : Ville de Lyon',
          onChange: (e) => setForm((prev) => ({ ...prev, name: e.target.value })),
        }}
      />
      <Input
        label="Contact (optionnel)"
        nativeInputProps={{
          value: form.contact,
          placeholder: 'email ou personne référente',
          onChange: (e) => setForm((prev) => ({ ...prev, contact: e.target.value })),
        }}
      />
      <Input
        label="Description (optionnel)"
        textArea
        nativeTextAreaProps={{
          value: form.description,
          placeholder: "Usage prévu de l'API",
          onChange: (e) => setForm((prev) => ({ ...prev, description: e.target.value })),
        }}
      />
      <OwnerPicker
        label="Bailleur (facultatif)"
        hintText="Cette clé donne accès aux coordonnées des demandes de contact de toutes les résidences du bailleur."
        value={form.owner}
        onChange={(owner) => setForm((prev) => ({ ...prev, owner }))}
      />
      {form.owner?.contactMode !== undefined && form.owner.contactMode !== EOwnerContactMode.CONTACTS && (
        <Alert
          severity="warning"
          small
          className="fr-mb-2w"
          description="Ce bailleur n'est pas en mode contacts : l'API renverra une liste vide."
        />
      )}
      <div className="fr-grid-row fr-grid-row--gutters">
        <div className="fr-col-6">
          <Input
            label="Rate-limit : requêtes"
            hintText="Laisser vide = défaut global"
            nativeInputProps={{
              type: 'number',
              min: 1,
              value: form.rateLimitMax,
              onChange: (e) => setForm((prev) => ({ ...prev, rateLimitMax: e.target.value })),
            }}
          />
        </div>
        <div className="fr-col-6">
          <Input
            label="Rate-limit : fenêtre (s)"
            hintText="Durée de la fenêtre en secondes"
            nativeInputProps={{
              type: 'number',
              min: 1,
              value: form.rateLimitWindowSeconds,
              onChange: (e) => setForm((prev) => ({ ...prev, rateLimitWindowSeconds: e.target.value })),
            }}
          />
        </div>
      </div>
      {mode === 'edit' && (
        <div className="fr-flex fr-flex-gap-4v">
          <ToggleSwitch
            label="Clé active"
            checked={form.enabled}
            onChange={(checked) => setForm((prev) => ({ ...prev, enabled: checked }))}
          />
          <ToggleSwitch
            label="Rate-limit activé"
            checked={form.rateLimitEnabled}
            onChange={(checked) => setForm((prev) => ({ ...prev, rateLimitEnabled: checked }))}
          />
        </div>
      )}
    </>
  )
}
