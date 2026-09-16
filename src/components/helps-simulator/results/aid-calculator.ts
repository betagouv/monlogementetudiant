import { type HelpSimulatorFormData } from '~/components/helps-simulator/help-simulator-schema'

// Types
export type Zone = 1 | 2 | 3
export type AidId = 'caf-aides-logement' | 'visale' | 'mobili-jeune' | 'loca-pass' | 'crous-mobilite-parcoursup' | 'crous-mobilite-master'

/**
 * Message à traduire dans le namespace `simulator.aids`. Le calcul reste indépendant de React :
 * les libellés sont résolus à l'affichage.
 */
export interface TAidMessage {
  key: string
  /** Valeurs déjà mises en forme : `{ rentCap: '1000' }` s'affiche « 1000 » et non « 1 000 ». */
  values?: Record<string, string>
}

type EligibilityResult =
  | { isEligible: true; amount?: number; amountLabel?: TAidMessage; warningMessage?: TAidMessage }
  | { isEligible: false; ineligibilityReason: TAidMessage }

export interface AidResult {
  id: AidId
  /** Clé du nom de l'aide (namespace `simulator.aids`). */
  nameKey: string
  isEligible: boolean
  amount?: number
  amountLabel?: TAidMessage
  ineligibilityReason?: TAidMessage
  warningMessage?: TAidMessage
  /** Clé de la description de l'aide (namespace `simulator.aids`). */
  descriptionKey: string
}

export interface CalculationResult {
  zone: Zone
  aids: AidResult[]
  eligibleCount: number
  totalEstimatedMonthly: number
  /** Clés des aides locales (namespace `simulator.results.localAids`). */
  localAids: string[]
}

// Clé de chaque aide dans le namespace `simulator.aids`
const AID_MESSAGE_KEYS: Record<AidId, string> = {
  'caf-aides-logement': 'cafAidesLogement',
  visale: 'visale',
  'mobili-jeune': 'mobiliJeune',
  'loca-pass': 'locaPass',
  'crous-mobilite-parcoursup': 'crousMobiliteParcoursup',
  'crous-mobilite-master': 'crousMobiliteMaster',
}

const aidMessage = (key: string, values?: Record<string, number>): TAidMessage =>
  values ? { key, values: Object.fromEntries(Object.entries(values).map(([name, value]) => [name, String(value)])) } : { key }

// Zone constants
const ZONE_1_CITIES = ['paris']
const ZONE_2_CITIES = ['lyon', 'marseille', 'toulouse', 'lille', 'bordeaux', 'nice', 'nantes', 'strasbourg', 'montpellier', 'rennes']

// Île-de-France cities for Visale zone I
const ILE_DE_FRANCE_CITIES = [
  'paris',
  'boulogne-billancourt',
  'saint-denis',
  'argenteuil',
  'montreuil',
  'créteil',
  'nanterre',
  'versailles',
  'évry',
  'cergy',
  'meaux',
  'melun',
  'massy',
  'pontoise',
  'bobigny',
  'vitry-sur-seine',
  'colombes',
  'asnières-sur-seine',
  'courbevoie',
  'rueil-malmaison',
  'champigny-sur-marne',
  'aubervilliers',
  'aulnay-sous-bois',
  'drancy',
  'noisy-le-grand',
  'ivry-sur-seine',
  'clichy',
  'clamart',
  'fontenay-sous-bois',
  'sartrouville',
  'antony',
  'maisons-alfort',
  'épinay-sur-seine',
  'sevran',
  'pantin',
  'bondy',
  'les mureaux',
  'chelles',
]

// Cities >100k inhabitants for Visale zone II
const VISALE_ZONE_2_CITIES = [
  'lyon',
  'marseille',
  'toulouse',
  'lille',
  'bordeaux',
  'nice',
  'nantes',
  'strasbourg',
  'montpellier',
  'rennes',
  'reims',
  'toulon',
  'le havre',
  'saint-étienne',
  'grenoble',
  'dijon',
  'angers',
  'nîmes',
  'aix-en-provence',
  'clermont-ferrand',
  'brest',
  'tours',
  'amiens',
  'limoges',
  'metz',
  'perpignan',
  'besançon',
  'orléans',
  'rouen',
  'mulhouse',
  'caen',
  'nancy',
  'ajaccio',
  'bastia',
  'fort-de-france',
  'pointe-à-pitre',
  'cayenne',
  'mamoudzou',
  'saint-pierre',
]

const VISALE_RENT_CAPS: Record<Zone, number> = {
  1: 1000,
  2: 840,
  3: 680,
}

const LOCAL_AIDS: Record<string, string[]> = {
  paris: ['parisLogement', 'parisGuarantees'],
  lyon: ['lyonMetropolis'],
  marseille: ['municipal'],
  toulouse: ['municipal'],
  bordeaux: ['municipal'],
  nantes: ['municipal'],
  lille: ['municipal'],
}

// Helper to build AidResult from id and eligibility result
function buildAidResult(id: AidId, eligibility: EligibilityResult): AidResult {
  const messageKey = AID_MESSAGE_KEYS[id]
  return {
    id,
    nameKey: `${messageKey}.name`,
    descriptionKey: `${messageKey}.description`,
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

export function getVisaleZone(city: string): Zone {
  const normalizedCity = city.toLowerCase().trim()
  if (ILE_DE_FRANCE_CITIES.some((c) => normalizedCity.includes(c))) return 1
  if (VISALE_ZONE_2_CITIES.some((c) => normalizedCity.includes(c))) return 2
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

function calculateCafAidesLogement(input: HelpSimulatorFormData): AidResult {
  const annualIncome = input.monthlyIncome * 12
  const rentUnknown = input.rentUnknown === true
  const hasRent = (input.monthlyRent !== undefined && input.monthlyRent > 0) || rentUnknown

  // Décret n° 2026-552 du 27 juin 2026 : les étudiants internationaux extra-communautaires
  // perdent le droit aux APL, sauf s'ils sont salariés, boursiers du CROUS, ou apprentis/alternants.
  const isInternationalStudent = input.isInternationalStudent === true
  const hasQualifyingStatus =
    input.status.includes('employed-student') || input.status.includes('boursier-crous') || input.status.includes('apprentice')

  if (isInternationalStudent && !hasQualifyingStatus) {
    return buildAidResult('caf-aides-logement', {
      isEligible: false,
      ineligibilityReason: aidMessage('cafAidesLogement.reasons.internationalStudent'),
    })
  }

  if (annualIncome >= 15800) {
    return buildAidResult('caf-aides-logement', {
      isEligible: false,
      ineligibilityReason: aidMessage('cafAidesLogement.reasons.incomeCap'),
    })
  }

  if (!hasRent) {
    return buildAidResult('caf-aides-logement', {
      isEligible: false,
      ineligibilityReason: aidMessage('reasons.rentRequired'),
    })
  }

  let amount: number | undefined
  let amountLabel: TAidMessage

  if (!rentUnknown && input.monthlyRent !== undefined) {
    amount = Math.round(Math.min(input.monthlyRent * 0.5, 300))
    amountLabel = aidMessage('cafAidesLogement.amountUpTo', { amount })
  } else {
    amountLabel = aidMessage('cafAidesLogement.amountUpToDefault')
  }

  let warningMessage: TAidMessage | undefined
  if (annualIncome >= 14000 && annualIncome < 15800) {
    warningMessage = aidMessage('cafAidesLogement.warningIncomeNearCap')
  }

  return buildAidResult('caf-aides-logement', { isEligible: true, amount, amountLabel, warningMessage })
}

function calculateVisale(input: HelpSimulatorFormData): AidResult {
  const rentUnknown = input.rentUnknown === true

  if (input.age < 18 || input.age > 30) {
    return buildAidResult('visale', {
      isEligible: false,
      ineligibilityReason: aidMessage('visale.reasons.age'),
    })
  }

  if (input.hasGuarantor === 'yes') {
    return buildAidResult('visale', {
      isEligible: false,
      ineligibilityReason: aidMessage('visale.reasons.hasGuarantor'),
    })
  }

  if (!rentUnknown && input.monthlyRent !== undefined && input.monthlyRent > 0) {
    const visaleZone = getVisaleZone(input.city)
    const rentCap = VISALE_RENT_CAPS[visaleZone]
    if (input.monthlyRent >= rentCap) {
      return buildAidResult('visale', {
        isEligible: false,
        ineligibilityReason: aidMessage('visale.reasons.rentCap', { rentCap }),
      })
    }
  }

  return buildAidResult('visale', { isEligible: true, amountLabel: aidMessage('visale.amount') })
}

function calculateMobiliJeune(input: HelpSimulatorFormData): AidResult {
  const rentUnknown = input.rentUnknown === true
  const hasRent = (input.monthlyRent !== undefined && input.monthlyRent > 0) || rentUnknown

  if (!input.status.includes('apprentice')) {
    return buildAidResult('mobili-jeune', {
      isEligible: false,
      ineligibilityReason: aidMessage('mobiliJeune.reasons.apprenticeOnly'),
    })
  }

  if (input.age >= 30) {
    return buildAidResult('mobili-jeune', {
      isEligible: false,
      ineligibilityReason: aidMessage('reasons.under30'),
    })
  }

  if (!hasRent) {
    return buildAidResult('mobili-jeune', {
      isEligible: false,
      ineligibilityReason: aidMessage('reasons.rentRequired'),
    })
  }

  const warningMessage = aidMessage('mobiliJeune.warning')

  if (!rentUnknown && input.monthlyRent !== undefined) {
    const cafAmount = Math.round(Math.min(input.monthlyRent * 0.5, 300))
    const rawAmount = input.monthlyRent - cafAmount - 10
    const amount = Math.round(Math.max(10, Math.min(rawAmount, 100)))
    return buildAidResult('mobili-jeune', {
      isEligible: true,
      amount,
      amountLabel: aidMessage('mobiliJeune.amountRange', { amount }),
      warningMessage,
    })
  }

  return buildAidResult('mobili-jeune', {
    isEligible: true,
    amountLabel: aidMessage('mobiliJeune.amountDefault'),
    warningMessage,
  })
}

function calculateLocaPass(input: HelpSimulatorFormData): AidResult {
  const rentUnknown = input.rentUnknown === true
  const hasRent = (input.monthlyRent !== undefined && input.monthlyRent > 0) || rentUnknown

  if (input.age >= 30) {
    return buildAidResult('loca-pass', {
      isEligible: false,
      ineligibilityReason: aidMessage('reasons.under30'),
    })
  }

  if (!input.status.includes('employed-student') && !input.status.includes('apprentice')) {
    return buildAidResult('loca-pass', {
      isEligible: false,
      ineligibilityReason: aidMessage('locaPass.reasons.employedOrApprentice'),
    })
  }

  if (!hasRent) {
    return buildAidResult('loca-pass', {
      isEligible: false,
      ineligibilityReason: aidMessage('reasons.rentRequired'),
    })
  }

  return buildAidResult('loca-pass', {
    isEligible: true,
    amountLabel: aidMessage('locaPass.amount'),
    warningMessage: aidMessage('locaPass.warning'),
  })
}

function calculateCrousMobiliteParcoursup(input: HelpSimulatorFormData): AidResult {
  if (input.currentYear !== 'terminale') {
    return buildAidResult('crous-mobilite-parcoursup', {
      isEligible: false,
      ineligibilityReason: aidMessage('crousMobiliteParcoursup.reasons.terminaleOnly'),
    })
  }

  if (input.scholarship !== 'bourse-lycee') {
    return buildAidResult('crous-mobilite-parcoursup', {
      isEligible: false,
      ineligibilityReason: aidMessage('crousMobiliteParcoursup.reasons.lyceeScholarshipOnly'),
    })
  }

  if (input.changingRegion !== 'yes') {
    return buildAidResult('crous-mobilite-parcoursup', {
      isEligible: false,
      ineligibilityReason: aidMessage('crousMobiliteParcoursup.reasons.changingRegion'),
    })
  }

  return buildAidResult('crous-mobilite-parcoursup', {
    isEligible: true,
    amount: 500,
    amountLabel: aidMessage('crousMobiliteParcoursup.amount'),
  })
}

function calculateCrousMobiliteMaster(input: HelpSimulatorFormData): AidResult {
  if (input.currentYear !== 'licence3') {
    return buildAidResult('crous-mobilite-master', {
      isEligible: false,
      ineligibilityReason: aidMessage('crousMobiliteMaster.reasons.licence3Only'),
    })
  }

  if (input.isProfessionalLicence === 'yes') {
    return buildAidResult('crous-mobilite-master', {
      isEligible: false,
      ineligibilityReason: aidMessage('crousMobiliteMaster.reasons.professionalLicence'),
    })
  }

  if (input.scholarship !== 'bourse-crous') {
    return buildAidResult('crous-mobilite-master', {
      isEligible: false,
      ineligibilityReason: aidMessage('crousMobiliteMaster.reasons.crousScholarshipOnly'),
    })
  }

  if (input.changingRegion !== 'yes') {
    return buildAidResult('crous-mobilite-master', {
      isEligible: false,
      ineligibilityReason: aidMessage('crousMobiliteMaster.reasons.changingRegion'),
    })
  }

  const warningMessage =
    input.isProfessionalLicence === 'unknown' ? aidMessage('crousMobiliteMaster.warningProfessionalLicenceUnknown') : undefined

  return buildAidResult('crous-mobilite-master', {
    isEligible: true,
    amount: 1000,
    amountLabel: aidMessage('crousMobiliteMaster.amount'),
    warningMessage,
  })
}

// Main calculation function
export function calculateAllAids(input: HelpSimulatorFormData): CalculationResult {
  const zone = getZone(input.city)

  const cafResult = calculateCafAidesLogement(input)
  const visaleResult = calculateVisale(input)
  const mobiliJeuneResult = calculateMobiliJeune(input)
  const locaPassResult = calculateLocaPass(input)

  const aids: AidResult[] = [cafResult, visaleResult, mobiliJeuneResult, locaPassResult]

  aids.push(calculateCrousMobiliteParcoursup(input))
  aids.push(calculateCrousMobiliteMaster(input))

  const eligibleCount = aids.filter((aid) => aid.isEligible).length

  // Les aides mobilité sont ponctuelles, on ne les inclut pas dans le total mensuel estimé
  const mobilityAidIds: AidId[] = ['crous-mobilite-parcoursup', 'crous-mobilite-master']
  const totalEstimatedMonthly = aids.filter((aid) => !mobilityAidIds.includes(aid.id)).reduce((total, aid) => total + (aid.amount || 0), 0)

  const localAids = getLocalAids(input.city)

  return {
    zone,
    aids,
    eligibleCount,
    totalEstimatedMonthly,
    localAids,
  }
}
