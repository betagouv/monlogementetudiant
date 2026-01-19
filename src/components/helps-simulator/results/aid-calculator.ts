import { type HelpSimulatorFormData } from '~/components/helps-simulator/help-simulator-schema'

// Types
export type Zone = 1 | 2 | 3
export type AidId = 'apl' | 'als' | 'visale' | 'mobili-jeune' | 'loca-pass' | 'crous'

export interface ZoneConfig {
  rentCap: number
  aplMax: number
  alsMax: number
}

interface AidDefinition {
  name: string
  description: string
}

type EligibilityResult = { isEligible: true; amount?: number; amountLabel?: string } | { isEligible: false; ineligibilityReason: string }

export interface AidResult {
  id: AidId
  name: string
  isEligible: boolean
  amount?: number
  amountLabel?: string
  ineligibilityReason?: string
  description: string
}

export interface CalculationResult {
  zone: Zone
  zoneConfig: ZoneConfig
  rentExceedsCap: boolean
  cappedRent: number
  aids: AidResult[]
  eligibleCount: number
  totalEstimatedMonthly: number
  localAids: string[]
}

// Aid definitions (static data)
const AID_DEFINITIONS: Record<AidId, AidDefinition> = {
  apl: {
    name: 'APL - Aide Personnalisée au Logement',
    description:
      "L'APL est une aide de la CAF pour réduire votre loyer. Elle est calculée en fonction de vos revenus, du montant de votre loyer et de votre situation.",
  },
  als: {
    name: 'ALS - Allocation de Logement Sociale',
    description:
      "L'ALS aide à payer votre loyer si vous n'êtes pas éligible à l'APL. Elle concerne les logements non conventionnés et varie selon votre zone géographique.",
  },
  visale: {
    name: 'Garantie Visale',
    description: "Action Logement se porte garant gratuitement pour vous. Idéal si vous n'avez pas de garant personnel.",
  },
  'mobili-jeune': {
    name: 'Mobili-Jeune',
    description: "Subvention d'Action Logement pour les alternants de moins de 30 ans, entre 10€ et 100€/mois.",
  },
  'loca-pass': {
    name: 'Avance Loca-Pass',
    description: "Prêt à 0% d'Action Logement pour financer votre dépôt de garantie (jusqu'à 1200€).",
  },
  crous: {
    name: 'Aide spécifique CROUS',
    description: 'Si vous êtes en difficulté financière, le CROUS peut vous accorder une aide ponctuelle ou annuelle.',
  },
}

// Constants
const ZONE_1_CITIES = ['paris']
const ZONE_2_CITIES = ['lyon', 'marseille', 'toulouse', 'lille', 'bordeaux', 'nice', 'nantes', 'strasbourg', 'montpellier', 'rennes']

const ZONE_CONFIG: Record<Zone, ZoneConfig> = {
  1: { rentCap: 350, aplMax: 400, alsMax: 320 },
  2: { rentCap: 280, aplMax: 320, alsMax: 260 },
  3: { rentCap: 250, aplMax: 270, alsMax: 220 },
}

const LOCAL_AIDS: Record<string, string[]> = {
  paris: ['Paris Logement', 'Garanties Ville de Paris'],
  lyon: ['Aides de la Métropole de Lyon'],
  marseille: ['Aides municipales/métropolitaines possibles'],
  toulouse: ['Aides municipales/métropolitaines possibles'],
  bordeaux: ['Aides municipales/métropolitaines possibles'],
  nantes: ['Aides municipales/métropolitaines possibles'],
  lille: ['Aides municipales/métropolitaines possibles'],
}

// Helper to build AidResult from id and eligibility result
function buildAidResult(id: AidId, eligibility: EligibilityResult): AidResult {
  const definition = AID_DEFINITIONS[id]
  return {
    id,
    name: definition.name,
    description: definition.description,
    ...eligibility,
  }
}

// Zone determination
export function getZone(city: string): Zone {
  const normalizedCity = city.toLowerCase().trim()
  if (ZONE_1_CITIES.some((c) => normalizedCity.includes(c))) return 1
  if (ZONE_2_CITIES.some((c) => normalizedCity.includes(c))) return 2
  return 3
}

export function getLocalAids(city: string): string[] {
  const normalizedCity = city.toLowerCase().trim()
  for (const [cityKey, aids] of Object.entries(LOCAL_AIDS)) {
    if (normalizedCity.includes(cityKey)) {
      return aids
    }
  }
  return []
}

// Individual aid calculators
function calculateAPL(input: HelpSimulatorFormData, zoneConfig: ZoneConfig, cappedRent: number): AidResult {
  const annualIncome = input.monthlyIncome * 12

  if (input.status !== 'student') {
    return buildAidResult('apl', { isEligible: false, ineligibilityReason: 'Réservé aux étudiants' })
  }

  if (annualIncome >= 20000) {
    return buildAidResult('apl', { isEligible: false, ineligibilityReason: 'Vos revenus dépassent le plafond de 20 000€/an' })
  }

  const amount = Math.round(Math.min(cappedRent * 0.6, zoneConfig.aplMax))
  return buildAidResult('apl', { isEligible: true, amount, amountLabel: `Jusqu'à ${amount}€/mois` })
}

function calculateALS(input: HelpSimulatorFormData, zoneConfig: ZoneConfig, cappedRent: number, aplEligible: boolean): AidResult {
  const annualIncome = input.monthlyIncome * 12

  if (aplEligible) {
    return buildAidResult('als', { isEligible: false, ineligibilityReason: "Vous êtes déjà éligible à l'APL (non cumulable)" })
  }

  if (annualIncome >= 25000) {
    return buildAidResult('als', { isEligible: false, ineligibilityReason: 'Vos revenus dépassent le plafond de 25 000€/an' })
  }

  const amount = Math.round(Math.min(cappedRent * 0.5, zoneConfig.alsMax))
  return buildAidResult('als', { isEligible: true, amount, amountLabel: `Jusqu'à ${amount}€/mois` })
}

function calculateVisale(input: HelpSimulatorFormData): AidResult {
  if (input.age > 30 && input.status !== 'student') {
    return buildAidResult('visale', { isEligible: false, ineligibilityReason: 'Réservé aux moins de 30 ans ou étudiants' })
  }

  return buildAidResult('visale', { isEligible: true, amountLabel: "Garantie gratuite jusqu'à 36 mois" })
}

function calculateMobiliJeune(input: HelpSimulatorFormData): AidResult {
  if (input.status !== 'apprentice') {
    return buildAidResult('mobili-jeune', { isEligible: false, ineligibilityReason: 'Réservé aux apprentis et alternants' })
  }

  if (input.age >= 30) {
    return buildAidResult('mobili-jeune', { isEligible: false, ineligibilityReason: 'Réservé aux moins de 30 ans' })
  }

  if (input.monthlyRent <= 0) {
    return buildAidResult('mobili-jeune', { isEligible: false, ineligibilityReason: 'Vous devez avoir un loyer à charge' })
  }

  const rawAmount = input.monthlyRent * 0.3
  const amount = Math.round(Math.max(10, Math.min(rawAmount, 100)))
  return buildAidResult('mobili-jeune', { isEligible: true, amount, amountLabel: `Entre 10€ et ${amount}€/mois` })
}

function calculateLocaPass(): AidResult {
  return buildAidResult('loca-pass', { isEligible: true, amountLabel: "Prêt 0% jusqu'à 1 200€" })
}

function calculateCROUS(input: HelpSimulatorFormData): AidResult {
  const annualIncome = input.monthlyIncome * 12

  if (input.status !== 'student') {
    return buildAidResult('crous', { isEligible: false, ineligibilityReason: 'Réservé aux étudiants' })
  }

  if (annualIncome >= 15000) {
    return buildAidResult('crous', { isEligible: false, ineligibilityReason: 'Vos revenus dépassent le plafond de 15 000€/an' })
  }

  return buildAidResult('crous', { isEligible: true, amountLabel: 'Montant variable selon situation' })
}

// Main calculation function
export function calculateAllAids(input: HelpSimulatorFormData): CalculationResult {
  const zone = getZone(input.city)
  const zoneConfig = ZONE_CONFIG[zone]
  const rentExceedsCap = input.monthlyRent > zoneConfig.rentCap
  const cappedRent = Math.min(input.monthlyRent, zoneConfig.rentCap)

  const aplResult = calculateAPL(input, zoneConfig, cappedRent)
  const alsResult = calculateALS(input, zoneConfig, cappedRent, aplResult.isEligible)
  const visaleResult = calculateVisale(input)
  const mobiliJeuneResult = calculateMobiliJeune(input)
  const locaPassResult = calculateLocaPass()
  const crousResult = calculateCROUS(input)

  const aids = [aplResult, alsResult, visaleResult, mobiliJeuneResult, locaPassResult, crousResult]

  const eligibleCount = aids.filter((aid) => aid.isEligible).length
  const totalEstimatedMonthly = aids.reduce((total, aid) => total + (aid.amount || 0), 0)
  const localAids = getLocalAids(input.city)

  return {
    zone,
    zoneConfig,
    rentExceedsCap,
    cappedRent,
    aids,
    eligibleCount,
    totalEstimatedMonthly,
    localAids,
  }
}
