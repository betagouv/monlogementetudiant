import type { TBudgetSimulation } from '~/schemas/budget-simulation'

export const EXPENSE_COLORS: Record<TBudgetSimulation['activeExpenseTypes'][number], string> = {
  housing: '#ADADF9',
  housingCharges: '#9A9AE8',
  food: '#FCC63A',
  dailyLife: '#FFB6C1',
  communication: '#87CEEB',
  transport: '#B8FEC9',
  registrationFees: '#DDA0DD',
  cvec: '#C8A2C8',
  studyMaterials: '#E6D4FF',
  mutuelle: '#FABFF5',
  otherHealthcare: '#F5A3F0',
  enjoyment: '#FB9175',
  childcare: '#F0E68C',
  other: '#D3D3D3',
  securityDeposit: '#C5E1A5',
  agencyFees: '#FFD180',
  apartmentEquipment: '#80CBC4',
}
