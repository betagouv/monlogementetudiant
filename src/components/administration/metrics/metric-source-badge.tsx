import Badge from '@codegouvfr/react-dsfr/Badge'
import type { TMetricSource } from '~/enums/metric-item'

const SEVERITY = {
  'Base — étudiants connectés': 'info',
  'Matomo — toutes visites': 'new',
  'Relevé mensuel': 'success',
} as const

export const MetricSourceBadge = ({ source }: { source: TMetricSource }) => (
  <Badge small noIcon severity={SEVERITY[source]}>
    {source}
  </Badge>
)
