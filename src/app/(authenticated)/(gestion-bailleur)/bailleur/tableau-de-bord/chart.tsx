'use client'

import { Cell, Label, Pie, PieChart } from 'recharts'

interface ResidenceChartProps {
  available: number | null
  total: number
}

export const ResidenceChart = ({ available, total }: ResidenceChartProps) => {
  if (available === null) {
    return (
      <div className="fr-flex fr-align-items-center fr-flex-gap-6v">
        <PieChart width={72} height={72}>
          <Pie data={[{ value: 1 }]} cx="50%" cy="50%" innerRadius={24} outerRadius={32} dataKey="value" startAngle={90} endAngle={-270}>
            <Cell fill="#E5E5E5" />
            <Label value="-" position="center" fontSize={14} fontWeight="bold" fill="#000" />
          </Pie>
        </PieChart>
        <span className="fr-text--sm fr-text-mention--grey fr-mb-0">
          Disponibilité
          <br />
          non-renseignée
        </span>
      </div>
    )
  }

  const occupied = total - available
  const occupiedPercentage = total > 0 ? Math.round((occupied / total) * 100) : 0

  const data = [
    { name: 'occupés', value: occupied, color: '#F3EDE5' },
    { name: 'disponibles', value: available, color: '#4B9F6C' },
  ]

  return (
    <div className="fr-flex fr-align-items-center fr-flex-gap-6v">
      <PieChart width={72} height={72}>
        <Pie data={data} cx="50%" cy="50%" innerRadius={24} outerRadius={32} dataKey="value" startAngle={90} endAngle={-270}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
          <Label value={`${occupiedPercentage}%`} position="center" fontSize={12} fontWeight="bold" fill="#000" />
        </Pie>
      </PieChart>

      <div className="fr-flex fr-direction-column fr-flex-gap-2v">
        {data.map((item, index) => (
          <div key={index} className="fr-flex fr-align-items-center fr-flex-gap-2v">
            <div
              style={{
                width: '12px',
                height: '12px',
                backgroundColor: item.color,
                borderRadius: '50%',
                flexShrink: 0,
              }}
            />
            <span className="fr-text--sm fr-text-mention--grey fr-mb-0">
              {item.value} {item.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
