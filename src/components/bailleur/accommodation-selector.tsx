'use client'

import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import Checkbox from '@codegouvfr/react-dsfr/Checkbox'
import Input from '@codegouvfr/react-dsfr/Input'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { LiveRegion } from '~/components/ui/live-region'
import { ToggleSwitch } from '~/components/ui/toggle-switch'
import type { TAccommodationSelection } from '~/schemas/accommodations/accommodation-selection'
import { useTRPC } from '~/server/trpc/client'
import styles from './accommodation-selector.module.css'

const VISIBLE_LIMIT = 200

type ResidenceOption = { id: number; name: string; cityName: string | null }

type Props = {
  ownerId: number
  namespace: 'bailleur.users.scope' | 'bailleur.contacts.settingsModal.residences'
  value: TAccommodationSelection
  onChange: (value: TAccommodationSelection) => void
  initialSelection?: Array<{ id: number; name: string }>
}

export const AccommodationSelector = ({ ownerId, namespace, value, onChange, initialSelection = [] }: Props) => {
  const t = useTranslations(namespace)
  const trpc = useTRPC()
  const [search, setSearch] = useState('')

  const restricted = value.mode === 'restricted'
  const selectedIds = value.mode === 'restricted' ? value.accommodationIds : []

  const { data } = useQuery({
    ...trpc.bailleur.listOwnerResidences.queryOptions({ ownerId }),
    enabled: restricted,
  })

  const residences = useMemo(() => {
    const loaded = (data?.items ?? []) as ResidenceOption[]
    if (loaded.length > 0) return loaded
    return initialSelection.map((r) => ({ ...r, cityName: null }))
  }, [data, initialSelection])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const matches = needle ? residences.filter((r) => r.name.toLowerCase().includes(needle)) : residences
    return [...matches].sort((a, b) => Number(selectedIds.includes(b.id)) - Number(selectedIds.includes(a.id)))
  }, [residences, search, selectedIds])

  const visible = filtered.slice(0, VISIBLE_LIMIT)
  const hidden = filtered.length - visible.length

  const toggle = (id: number, checked: boolean) =>
    onChange({ mode: 'restricted', accommodationIds: checked ? [...selectedIds, id] : selectedIds.filter((i) => i !== id) })

  return (
    <div className="fr-mt-3w">
      <ToggleSwitch
        label={t('allLabel')}
        labelPosition="right"
        showCheckedHint={false}
        inputTitle={`accommodation-selector-all-${namespace}`}
        checked={!restricted}
        onChange={(checked) => onChange(checked ? { mode: 'all' } : { mode: 'restricted', accommodationIds: [] })}
        description={restricted ? t('restrictedHint') : t('allHint')}
        showDescription
      />

      {restricted && (
        <fieldset className={styles.fieldset}>
          <legend className="fr-sr-only">{t('legend')}</legend>

          <Input
            label={t('searchLabel')}
            nativeInputProps={{ value: search, onChange: (e) => setSearch(e.target.value), placeholder: t('searchPlaceholder') }}
          />

          <div className="fr-flex fr-align-items-center fr-justify-content-space-between fr-flex-wrap fr-flex-gap-2v fr-mb-1w">
            <p className="fr-text--sm fr-mb-0">{t('selectedCount', { count: selectedIds.length })}</p>
            <div className="fr-flex fr-flex-gap-1v">
              <Button
                priority="tertiary no outline"
                size="small"
                type="button"
                onClick={() => onChange({ mode: 'restricted', accommodationIds: residences.map((r) => r.id) })}
              >
                {t('selectAll')}
              </Button>
              <Button
                priority="tertiary no outline"
                size="small"
                type="button"
                onClick={() => onChange({ mode: 'restricted', accommodationIds: [] })}
              >
                {t('selectNone')}
              </Button>
            </div>
          </div>

          {selectedIds.length === 0 && <Alert className="fr-mb-2w" severity="warning" small description={t('emptyWarning')} />}

          <ul className={styles.list}>
            {visible.map((residence) => (
              <li key={residence.id}>
                <Checkbox
                  small
                  options={[
                    {
                      label: residence.cityName ? `${residence.name} — ${residence.cityName}` : residence.name,
                      nativeInputProps: {
                        checked: selectedIds.includes(residence.id),
                        onChange: (e) => toggle(residence.id, e.target.checked),
                      },
                    },
                  ]}
                />
              </li>
            ))}
          </ul>

          {hidden > 0 && <p className="fr-text--xs fr-text-mention--grey fr-mt-1w">{t('refineSearch', { count: hidden })}</p>}

          <LiveRegion message={t('selectedCount', { count: selectedIds.length })} />
        </fieldset>
      )}
    </div>
  )
}
