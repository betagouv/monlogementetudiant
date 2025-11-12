'use client'

import { Cell, Label, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

interface ResidenceChartProps {
  available: number
  total: number
}

export const ResidenceChart = ({ available, total }: ResidenceChartProps) => {
  const occupied = total - available
  const availablePercentage = total > 0 ? 100 - Math.round((available / total) * 100) : 0

  const data = [
    { name: 'Occupé', value: occupied, color: '#FA7A35' },
    { name: 'Disponible', value: available, color: '#4B9F6C' },
  ]

  return (
    <div className="fr-flex fr-direction-column fr-align-items-center fr-justify-content-center">
      <div style={{ height: '120px', width: '180px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={30} outerRadius={60} dataKey="value">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Label value={`${availablePercentage}%`} position="center" className="recharts-text recharts-label" fontSize={16} fill="#000" />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="fr-flex fr-direction-column fr-mt-2v fr-flex-gap-1v">
        {data.map((item, index) => (
          <div key={index} className="fr-flex fr-align-items-center fr-flex-gap-2v">
            <div
              style={{
                width: '8px',
                height: '8px',
                backgroundColor: item.color,
                borderRadius: '50%',
              }}
            />
            <span className="fr-text--xs fr-mb-0">
              {item.value} {item.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
