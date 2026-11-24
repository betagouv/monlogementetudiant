'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Select from '@codegouvfr/react-dsfr/Select'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useTRPC } from '~/server/trpc/client'
import { getRegionByDepartmentCode } from '~/utils/french-regions'
import { buildContactsExportHref, exportRegionOptions } from './contacts-export-options'

export const ContactsExport = ({ ownerId }: { ownerId?: number }) => {
  const t = useTranslations('bailleur.contacts.export')
  const trpc = useTRPC()
  const [region, setRegion] = useState('')
  const [residence, setResidence] = useState('')

  const { data } = useQuery(trpc.bailleur.listResidencesWithContactCounts.queryOptions({ ownerId }))
  const residences = data?.residences ?? []
  const regions = exportRegionOptions(residences)
  const residenceOptions = region ? residences.filter((r) => getRegionByDepartmentCode(r.departmentCode) === region) : residences

  return (
    <section className="fr-mb-6w" aria-labelledby="contacts-export-title">
      <h2 id="contacts-export-title" className="fr-h5 fr-mb-1w">
        {t('title')}
      </h2>
      <p className="fr-text--sm fr-text-mention--grey fr-mb-2w">{t('description')}</p>
      <div className="fr-grid-row fr-grid-row--gutters fr-grid-row--bottom">
        <div className="fr-col-12 fr-col-md-4">
          <Select
            label={t('regionLabel')}
            className="fr-mb-0"
            nativeSelectProps={{
              value: region,
              onChange: (e) => {
                setRegion(e.target.value)
                setResidence('')
              },
            }}
          >
            <option value="">{t('allRegions')}</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
        <div className="fr-col-12 fr-col-md-4">
          <Select
            label={t('residenceLabel')}
            className="fr-mb-0"
            nativeSelectProps={{ value: residence, onChange: (e) => setResidence(e.target.value) }}
          >
            <option value="">{t('allResidences')}</option>
            {residenceOptions.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="fr-col-12 fr-col-md-4">
          <Button
            priority="secondary"
            iconId="fr-icon-download-line"
            linkProps={{ href: buildContactsExportHref({ ownerId, region, residence }), prefetch: false }}
          >
            {t('button')}
          </Button>
        </div>
      </div>
    </section>
  )
}
