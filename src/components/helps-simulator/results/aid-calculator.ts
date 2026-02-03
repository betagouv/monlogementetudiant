import { type HelpSimulatorFormData } from '~/components/helps-simulator/help-simulator-schema'

// Types
export type Zone = 1 | 2 | 3
export type AidId = 'caf-aides-logement' | 'visale' | 'mobili-jeune' | 'loca-pass' | 'crous-mobilite'

interface AidDefinition {
  name: string
  description: string
}

type EligibilityResult =
  | { isEligible: true; amount?: number; amountLabel?: string; warningMessage?: string }
  | { isEligible: false; ineligibilityReason: string }

export interface AidResult {
  id: AidId
  name: string
  isEligible: boolean
  amount?: number
  amountLabel?: string
  ineligibilityReason?: string
  warningMessage?: string
  description: string
}

export interface CalculationResult {
  zone: Zone
  aids: AidResult[]
  eligibleCount: number
  totalEstimatedMonthly: number
  localAids: string[]
}

// Aid definitions (static data)
const AID_DEFINITIONS: Record<AidId, AidDefinition> = {
  'caf-aides-logement': {
    name: 'Aides au logement de la Caf (APL, ALS)',
    description:
      'Les aides au logement de la CAF permettent de réduire votre loyer. Elles sont calculées en fonction de vos revenus, du montant de votre loyer et de votre situation.',
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
    description: "Prêt à 0% d'Action Logement pour financer votre dépôt de garantie (jusqu'à 1 200€).",
  },
  'crous-mobilite': {
    name: 'Aide à la mobilité CROUS (Parcoursup)',
    description: 'Aide ponctuelle de 500€ pour les anciens boursiers du lycée qui changent de région via Parcoursup.',
  },
}

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

  if (annualIncome >= 15800) {
    return buildAidResult('caf-aides-logement', {
      isEligible: false,
      ineligibilityReason: 'Vos revenus dépassent le plafond de 15 800€/an pour une personne seule',
    })
  }

  if (!hasRent) {
    return buildAidResult('caf-aides-logement', {
      isEligible: false,
      ineligibilityReason: 'Vous devez avoir un loyer à charge',
    })
  }

  let amount: number | undefined
  let amountLabel: string

  if (!rentUnknown && input.monthlyRent !== undefined) {
    amount = Math.round(Math.min(input.monthlyRent * 0.5, 300))
    amountLabel = `Jusqu'à ${amount}€/mois`
  } else {
    amountLabel = "Jusqu'à 300€/mois"
  }

  let warningMessage: string | undefined
  if (annualIncome >= 14000 && annualIncome < 15800) {
    warningMessage =
      'Vos revenus sont proches du plafond accepté par la Caf pour une personne seule. Nous vous invitons à vérifier votre éligibilité directement sur le simulateur de la Caf.'
  }

  return buildAidResult('caf-aides-logement', { isEligible: true, amount, amountLabel, warningMessage })
}

function calculateVisale(input: HelpSimulatorFormData): AidResult {
  const rentUnknown = input.rentUnknown === true

  if (input.age < 18 || input.age > 30) {
    return buildAidResult('visale', {
      isEligible: false,
      ineligibilityReason: 'Réservé aux personnes âgées de 18 à 30 ans',
    })
  }

  if (input.hasGuarantor === 'yes') {
    return buildAidResult('visale', {
      isEligible: false,
      ineligibilityReason: "La Garantie Visale s'adresse aux personnes n'ayant pas de garant",
    })
  }

  if (!rentUnknown && input.monthlyRent !== undefined && input.monthlyRent > 0) {
    const visaleZone = getVisaleZone(input.city)
    const rentCap = VISALE_RENT_CAPS[visaleZone]
    if (input.monthlyRent >= rentCap) {
      return buildAidResult('visale', {
        isEligible: false,
        ineligibilityReason: `Votre loyer dépasse le plafond Visale de ${rentCap}€ pour votre zone`,
      })
    }
  }

  return buildAidResult('visale', { isEligible: true, amountLabel: "Garantie gratuite jusqu'à 36 mois" })
}

function calculateMobiliJeune(input: HelpSimulatorFormData): AidResult {
  const rentUnknown = input.rentUnknown === true
  const hasRent = (input.monthlyRent !== undefined && input.monthlyRent > 0) || rentUnknown

  if (input.status !== 'apprentice') {
    return buildAidResult('mobili-jeune', {
      isEligible: false,
      ineligibilityReason: 'Réservé aux apprentis et alternants',
    })
  }

  if (input.age >= 30) {
    return buildAidResult('mobili-jeune', {
      isEligible: false,
      ineligibilityReason: 'Réservé aux moins de 30 ans',
    })
  }

  if (!hasRent) {
    return buildAidResult('mobili-jeune', {
      isEligible: false,
      ineligibilityReason: 'Vous devez avoir un loyer à charge',
    })
  }

  const warningMessage =
    "Le montant de l'aide Mobili-Jeune dépend de votre entreprise de rattachement. Nous vous invitons à faire la simulation directement sur le site d'Action Logement."

  if (!rentUnknown && input.monthlyRent !== undefined) {
    const cafAmount = Math.round(Math.min(input.monthlyRent * 0.5, 300))
    const rawAmount = input.monthlyRent - cafAmount - 10
    const amount = Math.round(Math.max(10, Math.min(rawAmount, 100)))
    return buildAidResult('mobili-jeune', {
      isEligible: true,
      amount,
      amountLabel: `Entre 10€ et ${amount}€/mois`,
      warningMessage,
    })
  }

  return buildAidResult('mobili-jeune', {
    isEligible: true,
    amountLabel: 'Entre 10€ et 100€/mois',
    warningMessage,
  })
}

function calculateLocaPass(input: HelpSimulatorFormData): AidResult {
  const rentUnknown = input.rentUnknown === true
  const hasRent = (input.monthlyRent !== undefined && input.monthlyRent > 0) || rentUnknown

  if (input.age >= 30) {
    return buildAidResult('loca-pass', {
      isEligible: false,
      ineligibilityReason: 'Réservé aux moins de 30 ans',
    })
  }

  if (input.status === 'student') {
    return buildAidResult('loca-pass', {
      isEligible: false,
      ineligibilityReason: 'Réservé aux étudiants salariés et aux apprentis',
    })
  }

  if (!hasRent) {
    return buildAidResult('loca-pass', {
      isEligible: false,
      ineligibilityReason: 'Vous devez avoir un loyer à charge',
    })
  }

  return buildAidResult('loca-pass', {
    isEligible: true,
    amountLabel: "Prêt 0% jusqu'à 1 200€, remboursable en 25 mois",
    warningMessage:
      "Il s'agit d'un prêt et non pas d'une aide, cela implique des remboursements réguliers à prendre en compte dans son budget.",
  })
}

function calculateCrousMobilite(input: HelpSimulatorFormData): AidResult {
  if (input.changingRegion !== 'yes') {
    return buildAidResult('crous-mobilite', {
      isEligible: false,
      ineligibilityReason: 'Vous ne changez pas de région via Parcoursup',
    })
  }

  if (input.boursierLycee !== 'yes') {
    return buildAidResult('crous-mobilite', {
      isEligible: false,
      ineligibilityReason: "Vous n'étiez pas boursier(e) au lycée",
    })
  }

  return buildAidResult('crous-mobilite', {
    isEligible: true,
    amount: 500,
    amountLabel: '500€ (aide ponctuelle)',
  })
}

// Main calculation function
export function calculateAllAids(input: HelpSimulatorFormData): CalculationResult {
  const zone = getZone(input.city)

  const cafResult = calculateCafAidesLogement(input)
  const visaleResult = calculateVisale(input)
  const mobiliJeuneResult = calculateMobiliJeune(input)
  const locaPassResult = calculateLocaPass(input)
  const crousMobiliteResult = calculateCrousMobilite(input)

  const aids = [cafResult, visaleResult, mobiliJeuneResult, locaPassResult, crousMobiliteResult]

  const eligibleCount = aids.filter((aid) => aid.isEligible).length
  const totalEstimatedMonthly = aids.reduce((total, aid) => total + (aid.amount || 0), 0)
  const localAids = getLocalAids(input.city)

  return {
    zone,
    aids,
    eligibleCount,
    totalEstimatedMonthly,
    localAids,
  }
}
