/**
 * Référentiel de démonstration : territoires, bailleurs, résidences et comptes nominatifs.
 *
 * Tout est situé hors de Saint-Étienne et de Clermont-Ferrand (zones réservées aux specs e2e).
 */
import { eq } from 'drizzle-orm'
import { EOwnerContactMode } from '../../../enums/owner-contact-mode'
import { EResidenceType } from '../../../enums/residence-type'
import {
  accommodations,
  accommodationTypologies,
  adminOwnerLinks,
  bailleurAccommodationScopes,
  scholarshipSurveyOwners,
} from '../../../server/db/schema'
import type { TypologyDraft } from '../../../server/lib/typologies'
import {
  createAcademy,
  createAccommodation,
  createCity,
  createDepartment,
  createExternalSource,
  createOwner,
} from '../../fixtures/factories'
import { squareBoundary } from '../../helpers/geo'
import { getTestDb } from '../../helpers/test-db'
import { createCredentialUser } from '../accounts'
import type { Clock, Random } from '../random'

/** Comptes nominatifs, connexion avec SEED_PASSWORD. */
export const SEED_ACCOUNTS = {
  admin: 'admin@seed.mle.local',
  adminReferent: 'admin-referent@seed.mle.local',
  bailleur: 'bailleur@seed.mle.local',
  gestionnaire: 'gestionnaire@seed.mle.local',
  bailleurDossierFacile: 'bailleur-dossierfacile@seed.mle.local',
  bailleurSansContact: 'bailleur-sans-contact@seed.mle.local',
  etudiant: 'etudiant@seed.mle.local',
} as const

type Point = [number, number]

export type DemoResidence = {
  id: number
  slug: string
  name: string
  ownerId: number
  cityId: number
  published: boolean
  acceptsApplications: boolean
  typologyTypes: TypologyDraft['type'][]
}

export type DemoOwner = { id: number; name: string; slug: string; contactMode: EOwnerContactMode; managerIds: string[] }

export type DemoReferential = {
  cities: { id: number; name: string; departmentId: number; academyId: number }[]
  owners: { contacts: DemoOwner; dossierFacile: DemoOwner; none: DemoOwner; crous: DemoOwner }
  residences: DemoResidence[]
  adminIds: string[]
  studentAccountId: string
}

const typology = (
  type: TypologyDraft['type'],
  priceMin: number,
  priceMax: number,
  surface: [number, number],
  nbTotal: number,
  nbAvailable: number,
  colocation = false,
): TypologyDraft => ({
  type,
  priceMin,
  priceMax,
  superficieMin: surface[0],
  superficieMax: surface[1],
  nbTotal,
  nbAvailable,
  colocation,
})

const EQUIPMENT_FULL = {
  laundryRoom: true,
  commonAreas: true,
  bikeStorage: true,
  secureAccess: true,
  residenceManager: true,
  desk: true,
  cookingPlates: true,
  microwave: true,
  refrigerator: true,
  wifi: true,
  kitchenType: 'private',
  bathroom: 'private',
}

export async function seedReferential(lyonAcademyId: number, random: Random, clock: Clock): Promise<DemoReferential> {
  const db = getTestDb()

  // ── Territoires ──────────────────────────────────────────────────────────────
  const grenobleAcademy = await createAcademy({ name: 'Académie de Grenoble', slug: 'academie-de-grenoble' })
  const bordeauxAcademy = await createAcademy({ name: 'Académie de Bordeaux', slug: 'academie-de-bordeaux' })
  const dijonAcademy = await createAcademy({ name: 'Académie de Dijon', slug: 'academie-de-dijon' })

  const rhone = await createDepartment({ academyId: lyonAcademyId, name: 'Rhône', code: '69', slug: 'rhone' })
  const isere = await createDepartment({ academyId: grenobleAcademy.id, name: 'Isère', code: '38', slug: 'isere' })
  const gironde = await createDepartment({ academyId: bordeauxAcademy.id, name: 'Gironde', code: '33', slug: 'gironde' })
  const coteDor = await createDepartment({ academyId: dijonAcademy.id, name: "Côte-d'Or", code: '21', slug: 'cote-d-or' })

  // Ordres de grandeur publics (INSEE / SIES), arrondis : servent aux pages villes et territoires.
  const CITY_DEFS = [
    {
      key: 'lyon',
      name: 'Lyon',
      dep: rhone,
      academyId: lyonAcademyId,
      insee: '69123',
      postal: ['69001', '69003', '69007', '69008'],
      center: [4.835, 45.76] as Point,
      size: 0.06,
      popular: true,
      population: 520000,
      nbStudents: 160000,
      averageRent: 16.2,
      averageIncome: 24000,
    },
    {
      key: 'villeurbanne',
      name: 'Villeurbanne',
      dep: rhone,
      academyId: lyonAcademyId,
      insee: '69266',
      postal: ['69100'],
      center: [4.88, 45.77] as Point,
      size: 0.02,
      popular: false,
      population: 155000,
      nbStudents: 30000,
      averageRent: 14.1,
      averageIncome: 21000,
    },
    {
      key: 'grenoble',
      name: 'Grenoble',
      dep: isere,
      academyId: grenobleAcademy.id,
      insee: '38185',
      postal: ['38000', '38100'],
      center: [5.72, 45.19] as Point,
      size: 0.04,
      popular: true,
      population: 157000,
      nbStudents: 65000,
      averageRent: 13.4,
      averageIncome: 22000,
    },
    {
      key: 'bordeaux',
      name: 'Bordeaux',
      dep: gironde,
      academyId: bordeauxAcademy.id,
      insee: '33063',
      postal: ['33000', '33800'],
      center: [-0.58, 44.84] as Point,
      size: 0.05,
      popular: true,
      population: 260000,
      nbStudents: 105000,
      averageRent: 15.3,
      averageIncome: 23000,
    },
    {
      key: 'dijon',
      name: 'Dijon',
      dep: coteDor,
      academyId: dijonAcademy.id,
      insee: '21231',
      postal: ['21000'],
      center: [5.04, 47.32] as Point,
      size: 0.03,
      popular: false,
      population: 160000,
      nbStudents: 35000,
      averageRent: 12.1,
      averageIncome: 22500,
    },
  ]

  const cityByKey = new Map<string, { id: number; center: Point; postal: string; departmentId: number; academyId: number; name: string }>()
  for (const def of CITY_DEFS) {
    const city = await createCity({
      departmentId: def.dep.id,
      name: def.name,
      slug: def.key,
      postalCodes: def.postal,
      inseeCodes: [def.insee],
      popular: def.popular,
      population: def.population,
      nbStudents: def.nbStudents,
      averageRent: def.averageRent,
      averageIncome: def.averageIncome,
      boundary: squareBoundary(...def.center, def.size),
    })
    cityByKey.set(def.key, {
      id: city.id,
      center: def.center,
      postal: def.postal[0],
      departmentId: def.dep.id,
      academyId: def.academyId,
      name: def.name,
    })
  }
  const city = (key: string) => {
    const found = cityByKey.get(key)
    if (!found) throw new Error(`Ville de démonstration inconnue : ${key}`)
    return found
  }

  // ── Comptes admin ────────────────────────────────────────────────────────────
  const admin = await createCredentialUser({
    id: 'seed-admin',
    email: SEED_ACCOUNTS.admin,
    name: 'Alex Admin',
    firstname: 'Alex',
    lastname: 'Admin',
    role: 'admin',
  })
  const adminReferent = await createCredentialUser({
    id: 'seed-admin-referent',
    email: SEED_ACCOUNTS.adminReferent,
    name: 'Morgan Référent',
    firstname: 'Morgan',
    lastname: 'Référent',
    role: 'admin',
  })

  // ── Bailleurs ────────────────────────────────────────────────────────────────
  const trackedSince = clock.daysAgo(170)

  const bailleur = await createCredentialUser({
    id: 'seed-bailleur',
    email: SEED_ACCOUNTS.bailleur,
    name: 'Dominique Bernard',
    firstname: 'Dominique',
    lastname: 'Bernard',
    role: 'owner',
    bailleurRole: 'administrator',
    bailleurPermissions: ['manage_residences', 'manage_applications'],
  })
  const contactsOwner = await createOwner({
    userId: bailleur.id,
    name: 'Habitat Démo',
    slug: 'habitat-demo',
    url: 'https://habitat-demo.example.com',
    landingUrl: 'https://habitat-demo.example.com/etudiants',
    contactMode: EOwnerContactMode.CONTACTS,
    availabilityTrackedSince: trackedSince,
  })
  // Gestionnaire du même bailleur, limité à certaines résidences pour les candidatures.
  const gestionnaire = await createCredentialUser({
    id: 'seed-gestionnaire',
    email: SEED_ACCOUNTS.gestionnaire,
    name: 'Sacha Petit',
    firstname: 'Sacha',
    lastname: 'Petit',
    role: 'owner',
    ownerId: contactsOwner.id,
    bailleurRole: 'gestionnaire',
    bailleurPermissions: ['manage_residences', 'manage_applications'],
    applicationScopeRestricted: true,
  })

  const bailleurDf = await createCredentialUser({
    id: 'seed-bailleur-dossierfacile',
    email: SEED_ACCOUNTS.bailleurDossierFacile,
    name: 'Claude Moreau',
    firstname: 'Claude',
    lastname: 'Moreau',
    role: 'owner',
    bailleurRole: 'administrator',
    bailleurPermissions: ['manage_residences', 'manage_applications'],
  })
  const dossierFacileOwner = await createOwner({
    userId: bailleurDf.id,
    name: 'Études & Logis Démo',
    slug: 'etudes-et-logis-demo',
    url: 'https://etudes-logis-demo.example.com',
    contactMode: EOwnerContactMode.DOSSIER_FACILE,
    availabilityTrackedSince: trackedSince,
  })

  const bailleurNone = await createCredentialUser({
    id: 'seed-bailleur-sans-contact',
    email: SEED_ACCOUNTS.bailleurSansContact,
    name: 'Ange Laurent',
    firstname: 'Ange',
    lastname: 'Laurent',
    role: 'owner',
    bailleurRole: 'administrator',
    bailleurPermissions: ['manage_residences'],
  })
  const noneOwner = await createOwner({
    userId: bailleurNone.id,
    name: 'Campus Horizon Démo',
    slug: 'campus-horizon-demo',
    url: 'https://campus-horizon-demo.example.com',
    contactMode: EOwnerContactMode.NONE,
  })

  const crousOwner = await createOwner({ name: 'CROUS', slug: 'crous', url: 'https://www.lescrous.fr' })

  // Enquête boursiers : complétée chez Habitat Démo, en attente chez les deux autres (modale à la connexion).
  await db
    .insert(scholarshipSurveyOwners)
    .values({ ownerId: contactsOwner.id, completedAt: clock.daysAgo(20), completedByUserId: bailleur.id })

  // L'admin référent suit deux bailleurs.
  await db.insert(adminOwnerLinks).values([
    { userId: adminReferent.id, ownerId: contactsOwner.id },
    { userId: adminReferent.id, ownerId: dossierFacileOwner.id },
  ])

  // ── Résidences ───────────────────────────────────────────────────────────────
  type ResidenceDef = {
    slug: string
    name: string
    owner: DemoOwner
    cityKey: string
    offset: Point
    address: string
    typologies: TypologyDraft[]
    published?: boolean
    extra?: Partial<typeof accommodations.$inferInsert>
    /** Ancienneté (jours) de la dernière mise à jour des disponibilités. */
    availabilityAgeDays?: number
    crousReference?: string
  }

  const owners = {
    contacts: {
      id: contactsOwner.id,
      name: contactsOwner.name,
      slug: contactsOwner.slug,
      contactMode: EOwnerContactMode.CONTACTS,
      managerIds: [bailleur.id, gestionnaire.id],
    },
    dossierFacile: {
      id: dossierFacileOwner.id,
      name: dossierFacileOwner.name,
      slug: dossierFacileOwner.slug,
      contactMode: EOwnerContactMode.DOSSIER_FACILE,
      managerIds: [bailleurDf.id],
    },
    none: {
      id: noneOwner.id,
      name: noneOwner.name,
      slug: noneOwner.slug,
      contactMode: EOwnerContactMode.NONE,
      managerIds: [bailleurNone.id],
    },
    crous: { id: crousOwner.id, name: crousOwner.name, slug: crousOwner.slug, contactMode: EOwnerContactMode.NONE, managerIds: [] },
  } satisfies DemoReferential['owners']

  const RESIDENCES: ResidenceDef[] = [
    // Habitat Démo — parcours « contact »
    {
      slug: 'residence-demo-confluence',
      name: 'Résidence Démo Confluence',
      owner: owners.contacts,
      cityKey: 'lyon',
      offset: [-0.01, -0.02],
      address: '10 cours Charlemagne',
      typologies: [
        typology('t1', 480, 560, [18, 22], 60, 6),
        typology('t1_bis', 590, 640, [25, 30], 20, 2),
        typology('t2', 690, 780, [35, 45], 10, 0),
      ],
      extra: {
        ...EQUIPMENT_FULL,
        nbAccessibleApartments: 4,
        externalUrl: 'https://habitat-demo.example.com/confluence',
        phoneNumber: '0400000001',
      },
      availabilityAgeDays: 3,
    },
    {
      slug: 'residence-demo-coloc-part-dieu',
      name: 'Résidence Démo Coloc Part-Dieu',
      owner: owners.contacts,
      cityKey: 'lyon',
      offset: [0.02, 0],
      address: '5 rue de Bonnel',
      typologies: [typology('t4', 420, 470, [80, 95], 8, 1, true)],
      extra: { nbColivingApartments: 8, wifi: true, commonAreas: true },
      availabilityAgeDays: 12,
    },
    {
      slug: 'residence-demo-en-travaux',
      name: 'Résidence Démo En Travaux',
      owner: owners.contacts,
      cityKey: 'lyon',
      offset: [0.005, -0.015],
      address: '30 avenue Berthelot',
      typologies: [typology('t1', 450, 500, [18, 20], 40, 0)],
      published: false,
    },
    {
      slug: 'residence-demo-campus-doua',
      name: 'Résidence Démo Campus Doua',
      owner: owners.contacts,
      cityKey: 'villeurbanne',
      offset: [0.005, 0.008],
      address: '20 avenue Gaston Berger',
      typologies: [typology('t1', 430, 510, [17, 21], 120, 9), typology('t1_bis', 540, 600, [24, 28], 30, 3)],
      extra: { ...EQUIPMENT_FULL, nbAccessibleApartments: 6 },
      availabilityAgeDays: 1,
    },
    {
      slug: 'residence-demo-gratte-ciel',
      name: 'Résidence Démo Gratte-Ciel',
      owner: owners.contacts,
      cityKey: 'villeurbanne',
      offset: [-0.004, -0.003],
      address: '8 avenue Henri Barbusse',
      typologies: [typology('t1', 470, 530, [18, 22], 45, 2), typology('t2', 650, 720, [38, 44], 12, 1)],
      // Candidatures suspendues manuellement par le bailleur.
      extra: { applicationsSuspendedAt: clock.daysAgo(6), applicationsSuspendedById: bailleur.id, applicationsSuspensionReason: 'manual' },
      availabilityAgeDays: 40,
    },
    // Études & Logis Démo — parcours DossierFacile
    {
      slug: 'residence-demo-presqu-ile',
      name: "Résidence Démo Presqu'île",
      owner: owners.dossierFacile,
      cityKey: 'grenoble',
      offset: [0.004, 0.01],
      address: '3 rue Félix Esclangon',
      typologies: [typology('t1', 410, 490, [16, 20], 90, 7), typology('t1_bis', 520, 580, [22, 26], 25, 2)],
      extra: { ...EQUIPMENT_FULL, nbAccessibleApartments: 5 },
      availabilityAgeDays: 2,
    },
    {
      slug: 'residence-demo-saint-martin',
      name: "Résidence Démo Saint-Martin-d'Hères",
      owner: owners.dossierFacile,
      cityKey: 'grenoble',
      offset: [0.03, -0.005],
      address: '701 avenue Centrale',
      typologies: [typology('t1', 390, 450, [16, 19], 150, 11), typology('t2', 560, 610, [32, 38], 20, 0)],
      // Suspension automatique : candidatures non traitées.
      extra: {
        applicationsSuspendedAt: clock.daysAgo(3),
        applicationsSuspensionReason: 'unprocessed_applications',
        unprocessedApplicationsWarnedAt: clock.daysAgo(10),
      },
      availabilityAgeDays: 8,
    },
    {
      slug: 'residence-demo-dijon-montmuzard',
      name: 'Résidence Démo Dijon Campus',
      owner: owners.dossierFacile,
      cityKey: 'dijon',
      offset: [0.01, 0.002],
      address: '6 boulevard Gabriel',
      typologies: [typology('t1', 360, 420, [16, 19], 70, 4)],
      availabilityAgeDays: 20,
    },
    // Campus Horizon Démo — sans parcours de contact, disponibilités périmées
    {
      slug: 'residence-demo-bordeaux-victoire',
      name: 'Résidence Démo Victoire',
      owner: owners.none,
      cityKey: 'bordeaux',
      offset: [0.002, -0.01],
      address: '12 cours de la Marne',
      typologies: [typology('t1', 520, 610, [18, 23], 80, 5), typology('t1_bis', 630, 690, [25, 29], 15, 1)],
      extra: { externalUrl: 'https://campus-horizon-demo.example.com/victoire' },
      availabilityAgeDays: 75,
    },
    {
      slug: 'residence-demo-bordeaux-bastide',
      name: 'Résidence Démo Bastide',
      owner: owners.none,
      cityKey: 'bordeaux',
      offset: [0.015, 0.005],
      address: '40 avenue Thiers',
      typologies: [typology('t1', 500, 560, [18, 21], 60, 0)],
      availabilityAgeDays: 120,
    },
    {
      // Sans typologie : nombre de logements inconnu (métrique « résidences sans total »).
      slug: 'residence-demo-bordeaux-sans-total',
      name: 'Résidence Démo Chartrons',
      owner: owners.none,
      cityKey: 'bordeaux',
      offset: [-0.005, 0.02],
      address: '2 quai des Chartrons',
      typologies: [],
    },
    // CROUS
    {
      slug: 'residence-demo-crous-gerland',
      name: 'Résidence Démo Crous Gerland',
      owner: owners.crous,
      cityKey: 'lyon',
      offset: [0.01, -0.03],
      address: '60 avenue Jean Jaurès',
      typologies: [
        typology('t1', 260, 420, [9, 18], 300, 12),
        typology('t1_bis', 380, 470, [20, 25], 40, 3),
        typology('t2', 450, 520, [30, 38], 20, 1),
        typology('t4', 640, 720, [70, 80], 12, 2, true),
      ],
      extra: {
        externalUrl: 'https://trouverunlogement.lescrous.fr/',
        nbAccessibleApartments: 6,
        nbColivingApartments: 12,
        residenceType: EResidenceType.UNIVERSITAIRE_CONVENTIONNEE,
      },
      crousReference: 'SEED0001',
    },
    {
      slug: 'residence-demo-crous-grenoble',
      name: 'Résidence Démo Crous Berlioz',
      owner: owners.crous,
      cityKey: 'grenoble',
      offset: [0.025, 0.002],
      address: '1 rue des Universités',
      typologies: [typology('t1', 250, 390, [9, 18], 400, 25)],
      extra: { externalUrl: 'https://trouverunlogement.lescrous.fr/', residenceType: EResidenceType.UNIVERSITAIRE_CONVENTIONNEE },
      crousReference: 'SEED0002',
    },
    {
      slug: 'residence-demo-crous-bordeaux',
      name: 'Résidence Démo Crous Talence',
      owner: owners.crous,
      cityKey: 'bordeaux',
      offset: [-0.02, -0.04],
      address: '45 cours de la Libération',
      typologies: [typology('t1', 240, 380, [9, 17], 500, 30), typology('t2', 420, 480, [28, 34], 40, 2)],
      extra: { externalUrl: 'https://trouverunlogement.lescrous.fr/', residenceType: EResidenceType.UNIVERSITAIRE_CONVENTIONNEE },
      crousReference: 'SEED0003',
    },
  ]

  const residences: DemoResidence[] = []
  for (const def of RESIDENCES) {
    const target = city(def.cityKey)
    const published = def.published ?? true
    const created = await createAccommodation(
      {
        name: def.name,
        slug: def.slug,
        published,
        ownerId: def.owner.id,
        cityId: target.id,
        address: def.address,
        postalCode: target.postal,
        residenceType: EResidenceType.RESIDENCE_ETUDIANTE,
        targetAudience: 'etudiants',
        description: `<p>${def.name} : résidence fictive créée par le seed de développement.</p>`,
        externalReference: def.crousReference,
        createdAt: clock.daysAgo(random.int(200, 400)),
        updatedAt: clock.daysAgo(random.int(0, 30)),
        geom: { type: 'Point', coordinates: [target.center[0] + def.offset[0], target.center[1] + def.offset[1]] },
        ...def.extra,
      },
      def.typologies,
    )

    if (def.crousReference) await createExternalSource({ accommodationId: created.id, source: 'crous', sourceId: def.crousReference })

    if (def.availabilityAgeDays !== undefined && def.typologies.length > 0) {
      await db
        .update(accommodationTypologies)
        .set({ availabilityUpdatedAt: clock.daysAgo(def.availabilityAgeDays), availabilityUpdatedBy: def.owner.managerIds[0] ?? null })
        .where(eq(accommodationTypologies.accommodationId, created.id))
    }

    residences.push({
      id: created.id,
      slug: def.slug,
      name: def.name,
      ownerId: def.owner.id,
      cityId: target.id,
      published,
      acceptsApplications: created.acceptsApplications,
      typologyTypes: def.typologies.map((t) => t.type),
    })
  }

  // Le gestionnaire ne traite que les candidatures de Villeurbanne.
  const villeurbanne = city('villeurbanne').id
  await db
    .insert(bailleurAccommodationScopes)
    .values(residences.filter((r) => r.cityId === villeurbanne).map((r) => ({ userId: gestionnaire.id, accommodationId: r.id })))

  // ── Étudiant nominatif ───────────────────────────────────────────────────────
  const etudiant = await createCredentialUser({
    id: 'seed-etudiant',
    email: SEED_ACCOUNTS.etudiant,
    name: 'Camille Martin',
    firstname: 'Camille',
    lastname: 'Martin',
    phone: '0600000000',
    birthdate: '2005-03-14',
    scholarshipStatus: 'no',
    studyYear: 'bac_2',
    studyInstitution: 'Université Démo de Lyon',
    createdAt: clock.daysAgo(90),
  })

  return {
    cities: [...cityByKey.values()].map((c) => ({ id: c.id, name: c.name, departmentId: c.departmentId, academyId: c.academyId })),
    owners,
    residences,
    adminIds: [admin.id, adminReferent.id],
    studentAccountId: etudiant.id,
  }
}
