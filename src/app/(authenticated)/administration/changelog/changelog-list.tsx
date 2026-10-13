'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import Select from '@codegouvfr/react-dsfr/Select'
import Tag from '@codegouvfr/react-dsfr/Tag'
import { useState } from 'react'
import {
  CHANGELOG_PERIMETER_LABELS,
  CHANGELOG_PERIMETERS,
  CHANGELOG_TYPE_LABELS,
  CHANGELOG_TYPE_SEVERITY,
  CHANGELOG_TYPES,
} from '~/enums/changelog'
import { useAdminChangelog } from '~/hooks/use-admin-changelog'

const formatDate = (date: string) => new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

export const ChangelogList = () => {
  const { data: entries, isLoading } = useAdminChangelog()
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [perimeterFilter, setPerimeterFilter] = useState<string>('')

  if (isLoading) return <p>Chargement…</p>
  if (!entries || entries.length === 0) return <p className="fr-text--sm">Aucune entrée pour le moment.</p>

  const filtered = entries.filter((e) => (!typeFilter || e.type === typeFilter) && (!perimeterFilter || e.perimetre === perimeterFilter))

  return (
    <>
      <div className="fr-grid-row fr-grid-row--gutters fr-mb-2w">
        <div className="fr-col-12 fr-col-md-4">
          <Select label="Type" nativeSelectProps={{ value: typeFilter, onChange: (e) => setTypeFilter(e.target.value) }}>
            <option value="">Tous les types</option>
            {CHANGELOG_TYPES.map((t) => (
              <option key={t} value={t}>
                {CHANGELOG_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        <div className="fr-col-12 fr-col-md-4">
          <Select label="Périmètre" nativeSelectProps={{ value: perimeterFilter, onChange: (e) => setPerimeterFilter(e.target.value) }}>
            <option value="">Tous les périmètres</option>
            {CHANGELOG_PERIMETERS.map((p) => (
              <option key={p} value={p}>
                {CHANGELOG_PERIMETER_LABELS[p]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="fr-text--sm">Aucune entrée ne correspond à ces filtres.</p>
      ) : (
        <ul className="fr-raw-list">
          {filtered.map((entry) => (
            <li key={entry.slug} className="fr-card fr-card--no-border fr-p-3w fr-mb-2w">
              <div className="fr-mb-1w">
                <Badge severity={CHANGELOG_TYPE_SEVERITY[entry.type]} small>
                  {CHANGELOG_TYPE_LABELS[entry.type]}
                </Badge>
                {entry.perimetre && (
                  <Tag small className="fr-ml-1w">
                    {CHANGELOG_PERIMETER_LABELS[entry.perimetre]}
                  </Tag>
                )}
                <span className="fr-text--xs fr-text-mention--grey fr-ml-1w">{formatDate(entry.date)}</span>
              </div>
              <p className="fr-text--bold fr-mb-1v">{entry.title}</p>
              <p className="fr-text--sm fr-mb-0" style={{ whiteSpace: 'pre-line' }}>
                {entry.description}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
