'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { SegmentedControl } from '@codegouvfr/react-dsfr/SegmentedControl'
import { Table } from '@codegouvfr/react-dsfr/Table'
import { useQuery } from '@tanstack/react-query'
import { useFormatter, useTranslations } from 'next-intl'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { ZStatisticsPeriod } from '~/schemas/statistics/period'
import { useTRPC } from '~/server/trpc/client'
import { contactStatsShare } from '~/utils/contact-stats-share'

const PERIODS = ZStatisticsPeriod.options

type TCounts = { received: number; nonModere: number; nonRetenu: number; contacte: number; logementAttribue: number }

export const ContactStatsTable = ({ ownerId }: { ownerId?: number }) => {
  const t = useTranslations('bailleur.contacts.stats')
  const format = useFormatter()
  const trpc = useTRPC()
  const [period, setPeriod] = useQueryState('period', parseAsStringLiteral(PERIODS).withDefault('30d'))

  const { data } = useQuery(trpc.bailleur.contactStats.queryOptions({ period, ownerId }))

  const exportParams = new URLSearchParams({ period })
  if (ownerId) exportParams.set('ownerId', String(ownerId))

  const counts = (c: TCounts) =>
    [
      format.number(c.received),
      ...[c.nonModere, c.nonRetenu, c.contacte, c.logementAttribue].flatMap((n) => {
        const share = contactStatsShare(n, c.received)
        return [format.number(n), share === null ? '—' : `${share} %`]
      }),
    ] as const

  const rows = data?.rows ?? []
  const segment = (p: (typeof PERIODS)[number]) => ({
    label: t(`period.${p}`),
    nativeInputProps: { checked: p === period, onChange: () => setPeriod(p) },
  })
  const periodSegments: [ReturnType<typeof segment>, ReturnType<typeof segment>, ReturnType<typeof segment>] = [
    segment('7d'),
    segment('30d'),
    segment('90d'),
  ]

  return (
    <section className="fr-mb-6w" aria-labelledby="contact-stats-title">
      <div className="fr-flex fr-direction-column fr-direction-md-row fr-align-items-md-center fr-justify-content-md-space-between fr-flex-gap-4v fr-mb-2w">
        <h2 id="contact-stats-title" className="fr-h5 fr-mb-0">
          {t('title')}
        </h2>
        <div className="fr-flex fr-align-items-center fr-flex-gap-4v fr-flex-wrap">
          <SegmentedControl legend={t('periodLegend')} hideLegend small segments={periodSegments} />
          <Button
            priority="secondary"
            size="small"
            iconId="fr-icon-download-line"
            linkProps={{ href: `/api/bailleur/contacts/statistiques/export?${exportParams.toString()}`, prefetch: false }}
          >
            {t('export')}
          </Button>
        </div>
      </div>
      <Table
        noCaption
        caption={t('caption')}
        className="fr-mb-0"
        headers={[
          t('residence'),
          t('city'),
          t('received'),
          t('nonModere'),
          t('share', { label: t('nonModere') }),
          t('nonRetenu'),
          t('share', { label: t('nonRetenu') }),
          t('contacte'),
          t('share', { label: t('contacte') }),
          t('logementAttribue'),
          t('share', { label: t('logementAttribue') }),
        ]}
        data={[
          ...rows.map((row) => [row.residence, row.city ?? '', ...counts(row)]),
          ...(data
            ? [
                [
                  <strong key="total">{t('total')}</strong>,
                  '',
                  ...counts(data.total).map((cell, i) => <strong key={`total-${i}`}>{cell}</strong>),
                ],
              ]
            : []),
        ]}
      />
      {data && rows.length === 0 && <p className="fr-text--sm fr-text-mention--grey fr-mt-2w fr-mb-0">{t('empty')}</p>}
    </section>
  )
}
