/**
 * Activité de démonstration sur ~6 mois : étudiants, demandes de contact, candidatures DossierFacile,
 * événements de suivi, statistiques Matomo et données annexes (favoris, alertes, simulations, tickets…).
 *
 * Volumes volontairement modestes (quelques milliers de lignes au total) : assez pour peupler les
 * graphiques et les tableaux paginés, sans ralentir le seed ni les tests e2e.
 *
 * Les candidatures sont générées « brutes », avec des coordonnées fictives, comme si elles venaient
 * d'être déposées. L'anonymisation (contacts de plus de 30 jours) et la suppression (demandes non
 * confirmées, dossiers DossierFacile périmés) sont ensuite faites par le vrai job de purge RGPD
 * (./jobs.ts), après le calcul des métriques — même ordre qu'en production.
 *
 * Chaque changement de statut est tracé dans `activity_log` (`contact.status_updated`), comme le fait
 * le routeur bailleur : c'est la source des délais de traitement des métriques admin.
 */
import { DF_COLUMNS, EContactStatus } from '../../../enums/contact-status'
import { ELoginAttemptStatus } from '../../../enums/login-attempt-status'
import { EXPENSE_TYPES, INCOME_TYPES, type TBudgetSimulation } from '../../../schemas/budget-simulation'
import type { TImportJobType } from '../../../schemas/import-jobs'
import {
  accommodationReports,
  activityLog,
  apiKeyOwners,
  apiKeyUsageDaily,
  apikey,
  budgetSimulations,
  contactRequests,
  dossierFacileApplications,
  dossierFacileDocuments,
  dossierFacileTenants,
  eventStats,
  favoriteAccommodations,
  housingAidSimulations,
  importJobs,
  loginAttempts,
  ownerFeedback,
  scholarshipSurveyAnswers,
  stats,
  studentAlerts,
  studentGoalLists,
  studentGoals,
  supportTickets,
  trackingEvents,
  user,
} from '../../../server/db/schema'
import { getTestDb } from '../../helpers/test-db'
import { type Clock, fakeHash, fakeIdentity, type Random } from '../random'
import type { DemoOwner, DemoReferential, DemoResidence } from './referential'

const HISTORY_DAYS = 180
const STUDENT_COUNT = 40
const CONTACT_COUNT = 90
const DF_TENANT_COUNT = 24
const BATCH = 500

type Db = ReturnType<typeof getTestDb>
type Student = typeof user.$inferSelect

async function insertInBatches<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += BATCH) await insert(rows.slice(i, i + BATCH))
}

export async function seedActivity(ref: DemoReferential, random: Random, clock: Clock) {
  const db = getTestDb()
  const students = await seedStudents(db, ref, random, clock)
  await seedContactRequests(db, ref, students, random, clock)
  await seedDossierFacile(db, ref, students, random, clock)
  await seedStudentSpace(db, ref, students, random, clock)
  await seedTrackingEvents(db, ref, students, random, clock)
  await seedMatomoStats(db, random, clock)
  await seedOwnerSide(db, ref, random, clock)
  await seedSupport(db, ref, students, random, clock)
  await seedPlatform(db, ref, random, clock)
}

// ── Étudiants ─────────────────────────────────────────────────────────────────

async function seedStudents(db: Db, ref: DemoReferential, random: Random, clock: Clock): Promise<Student[]> {
  const institutions = [
    'Université Démo de Lyon',
    'Université Démo Grenoble Alpes',
    'Université Démo de Bordeaux',
    'École Démo d’ingénieurs',
    'IUT Démo',
  ]
  const rows: (typeof user.$inferInsert)[] = []
  for (let i = 1; i <= STUDENT_COUNT; i++) {
    const identity = fakeIdentity(random, i)
    // Inscriptions croissantes dans le temps : plus d'étudiants récents que d'anciens.
    const age = Math.floor(HISTORY_DAYS * (1 - Math.sqrt(random.next())))
    const profileComplete = random.chance(0.8)
    rows.push({
      id: `seed-etudiant-${String(i).padStart(3, '0')}`,
      email: identity.email,
      emailVerified: random.chance(0.9),
      name: identity.name,
      firstname: identity.firstname,
      lastname: identity.lastname,
      role: 'user',
      phone: profileComplete ? identity.phone : null,
      birthdate: profileComplete ? identity.birthdate : null,
      scholarshipStatus: random.weighted([
        ['yes', 35],
        ['no', 45],
        ['unknown', 10],
        [null, 10],
      ] as const),
      isWorkStudy: profileComplete ? random.chance(0.15) : null,
      studyYear: profileComplete ? random.pick(['bac_1', 'bac_2', 'bac_3', 'bac_4', 'bac_5_plus'] as const) : null,
      studyInstitution: profileComplete ? random.pick(institutions) : null,
      createdAt: clock.daysAgo(age + random.next()),
      updatedAt: clock.daysAgo(Math.max(0, age - random.int(0, 20))),
    })
  }
  await db.insert(user).values(rows)
  const inserted = await db.query.user.findMany({ where: (u, { like }) => like(u.id, 'seed-etudiant-%') })
  const account = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.id, ref.studentAccountId) })
  return account ? [account, ...inserted] : inserted
}

// ── Parcours contact ─────────────────────────────────────────────────────────

/** Statut final d'une demande selon son ancienneté : les récentes sont surtout à traiter. */
function pickFinalStatus(random: Random, ageDays: number, columns: readonly EContactStatus[]): EContactStatus {
  if (ageDays < 4) return random.chance(0.75) ? columns[0] : EContactStatus.CONTACTE
  const weights: [EContactStatus, number][] = [
    [EContactStatus.A_CONTACTER, ageDays < 30 ? 20 : 6],
    [EContactStatus.CONTACTE, 40],
    [EContactStatus.NON_RETENU, 22],
    [EContactStatus.LOGEMENT_ATTRIBUE, 14],
  ]
  if (columns.includes(EContactStatus.A_MODERER)) weights.push([EContactStatus.A_MODERER, ageDays < 30 ? 15 : 3])
  return random.weighted(weights)
}

/** Étapes de statut successives (hors statut initial) jusqu'au statut final. */
function statusPath(initial: EContactStatus, final: EContactStatus): EContactStatus[] {
  if (final === initial) return []
  if (final === EContactStatus.LOGEMENT_ATTRIBUE) {
    return initial === EContactStatus.A_MODERER
      ? [EContactStatus.A_CONTACTER, EContactStatus.CONTACTE, EContactStatus.LOGEMENT_ATTRIBUE]
      : [EContactStatus.CONTACTE, EContactStatus.LOGEMENT_ATTRIBUE]
  }
  if (final === EContactStatus.CONTACTE && initial === EContactStatus.A_MODERER)
    return [EContactStatus.A_CONTACTER, EContactStatus.CONTACTE]
  return [final]
}

type StatusHistory = { reviewedAt: Date | null; contactedAt: Date | null; logs: (typeof activityLog.$inferInsert)[] }

function buildStatusHistory(
  random: Random,
  clock: Clock,
  params: {
    createdAt: Date
    initial: EContactStatus
    final: EContactStatus
    entityType: 'contact_request' | 'dossier_facile_application'
    entityId: string
    residence: DemoResidence
    owner: DemoOwner
  },
): StatusHistory {
  const steps = statusPath(params.initial, params.final)
  let at = params.createdAt
  let previous = params.initial
  let reviewedAt: Date | null = null
  let contactedAt: Date | null = null
  const logs: (typeof activityLog.$inferInsert)[] = []
  const actorId = params.owner.managerIds.length > 0 ? random.pick(params.owner.managerIds) : undefined

  for (const step of steps) {
    // Délai de traitement de quelques heures à quelques jours, sans dépasser « maintenant ».
    at = new Date(Math.min(clock.now.getTime() - 60_000, at.getTime() + random.int(2, 96) * 3_600_000))
    reviewedAt ??= at
    if (step === EContactStatus.CONTACTE) contactedAt = at
    logs.push({
      createdAt: at,
      userId: actorId,
      userName: actorId ? 'Gestionnaire démo' : undefined,
      action: 'contact.status_updated',
      entityType: params.entityType,
      entityId: params.entityId,
      entityName: params.residence.name,
      ownerId: params.owner.id,
      ownerName: params.owner.name,
      metadata: { slug: params.residence.slug, diff: { contactStatus: { old: previous, new: step } } },
    })
    previous = step
  }
  return { reviewedAt, contactedAt, logs }
}

async function seedContactRequests(db: Db, ref: DemoReferential, students: Student[], random: Random, clock: Clock) {
  const owner = ref.owners.contacts
  const residences = ref.residences.filter((r) => r.ownerId === owner.id && r.published)
  const rows: (typeof contactRequests.$inferInsert)[] = []
  const logs: (typeof activityLog.$inferInsert)[] = []
  const takenStudentPairs = new Set<string>()

  for (let i = 1; i <= CONTACT_COUNT; i++) {
    const residence = random.pick(residences)
    const ageDays = Math.floor(HISTORY_DAYS * (1 - Math.sqrt(random.next())))
    const createdAt = clock.daysAgo(ageDays + random.next())
    const id = crypto.randomUUID()

    // ~40 % de demandes faites depuis un compte étudiant (une seule par résidence et par compte).
    let student: Student | undefined
    if (random.chance(0.4)) {
      const candidate = random.pick(students)
      const key = `${candidate.id}:${residence.id}`
      if (!takenStudentPairs.has(key) && candidate.createdAt <= createdAt) {
        takenStudentPairs.add(key)
        student = candidate
      }
    }
    // Une demande visiteur sur huit n'est jamais confirmée (double opt-in) : invisible du gestionnaire,
    // puis supprimée par la purge si elle a plus de 7 jours.
    const confirmed = !!student || random.chance(0.88)
    const final = confirmed
      ? pickFinalStatus(random, ageDays, [
          EContactStatus.A_CONTACTER,
          EContactStatus.NON_RETENU,
          EContactStatus.CONTACTE,
          EContactStatus.LOGEMENT_ATTRIBUE,
        ])
      : EContactStatus.A_CONTACTER
    const history = buildStatusHistory(random, clock, {
      createdAt,
      initial: EContactStatus.A_CONTACTER,
      final,
      entityType: 'contact_request',
      entityId: id,
      residence,
      owner,
    })
    logs.push(...history.logs)

    const identity = fakeIdentity(random, 500 + i, 'visiteur')
    rows.push({
      id,
      userId: student?.id ?? null,
      accommodationId: residence.id,
      firstname: student?.firstname ?? identity.firstname,
      lastname: student?.lastname ?? identity.lastname,
      email: student?.email ?? identity.email,
      phone: student?.phone ?? identity.phone,
      birthdate: student?.birthdate ?? identity.birthdate,
      scholarshipStatus: student?.scholarshipStatus ?? random.pick(['yes', 'no', 'unknown'] as const),
      isWorkStudy: student?.isWorkStudy ?? random.chance(0.15),
      studyInstitution: student?.studyInstitution ?? 'Université Démo',
      studyYear: student?.studyYear ?? random.pick(['bac_1', 'bac_2', 'bac_3', 'bac_4', 'bac_5_plus'] as const),
      apartmentType: random.pick(residence.typologyTypes),
      ipHash: fakeHash(random),
      // Les demandes liées à un compte sont confirmées d'office (pas de double opt-in).
      confirmedAt: confirmed && !student ? new Date(createdAt.getTime() + random.int(1, 120) * 60_000) : null,
      status: final,
      reviewedAt: history.reviewedAt,
      contactedAt: history.contactedAt,
      createdAt,
      updatedAt: history.logs.at(-1)?.createdAt ?? createdAt,
    })
  }

  await insertInBatches(rows, (chunk) => db.insert(contactRequests).values(chunk))
  await insertInBatches(logs, (chunk) => db.insert(activityLog).values(chunk))
}

// ── Parcours DossierFacile ───────────────────────────────────────────────────

async function seedDossierFacile(db: Db, ref: DemoReferential, students: Student[], random: Random, clock: Clock) {
  const owner = ref.owners.dossierFacile
  const residences = ref.residences.filter((r) => r.ownerId === owner.id && r.published)
  const tenantStudents = random.sample(students.slice(1), DF_TENANT_COUNT)
  const logs: (typeof activityLog.$inferInsert)[] = []

  for (const [index, student] of tenantStudents.entries()) {
    const [tenant] = await db
      .insert(dossierFacileTenants)
      .values({
        userId: student.id,
        tenantId: `seed-df-tenant-${String(index + 1).padStart(3, '0')}`,
        name: student.name,
        // Seuls les dossiers `verified` rendent la candidature visible du gestionnaire.
        status: random.weighted([
          ['verified', 7],
          ['to_process', 2],
          ['incomplete', 1],
        ] as const),
        url: `https://locataire.dossierfacile.example.com/file/seed-${index + 1}`,
        pdfUrl: `https://locataire.dossierfacile.example.com/file/seed-${index + 1}.pdf`,
        guarantorCount: random.int(0, 2),
        lastSyncedAt: clock.daysAgo(random.int(0, 10)),
        createdAt: student.createdAt,
      })
      .returning({ id: dossierFacileTenants.id })

    await db.insert(dossierFacileDocuments).values(
      ['IDENTIFICATION', 'RESIDENCY', 'PROFESSIONAL', 'FINANCIAL'].map((category) => ({
        tenantId: tenant.id,
        ownerType: 'TENANT',
        documentCategory: category,
        documentStatus: 'VALIDATED',
      })),
    )

    for (const residence of random.sample(residences, random.int(1, Math.min(3, residences.length)))) {
      const ageDays = Math.floor(150 * (1 - Math.sqrt(random.next())))
      const createdAt = clock.daysAgo(ageDays + random.next())
      const id = crypto.randomUUID()
      const final = pickFinalStatus(random, ageDays, DF_COLUMNS)
      const history = buildStatusHistory(random, clock, {
        createdAt,
        initial: EContactStatus.A_MODERER,
        final,
        entityType: 'dossier_facile_application',
        entityId: id,
        residence,
        owner,
      })
      logs.push(...history.logs)
      await db.insert(dossierFacileApplications).values({
        id,
        tenantId: tenant.id,
        accommodationSlug: residence.slug,
        apartmentType: random.pick(residence.typologyTypes),
        status: final,
        reviewedAt: history.reviewedAt,
        contactedAt: history.contactedAt,
        createdAt,
        updatedAt: history.logs.at(-1)?.createdAt ?? createdAt,
      })
    }
  }

  await insertInBatches(logs, (chunk) => db.insert(activityLog).values(chunk))
}

// ── Espace étudiant ──────────────────────────────────────────────────────────

function budgetSimulation(random: Random): TBudgetSimulation {
  const zero = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>
  const monthly = <K extends string>(keys: readonly K[]) =>
    Object.fromEntries(keys.map((k) => [k, 'monthly' as const])) as Record<K, 'monthly'>
  const incomes = zero(INCOME_TYPES)
  const expenses = zero(EXPENSE_TYPES)
  incomes.familyAid = random.int(0, 4) * 100
  incomes.scholarships = random.chance(0.4) ? random.int(1, 6) * 100 : 0
  incomes.cafHousingAid = random.int(0, 25) * 10
  incomes.salary = random.chance(0.3) ? random.int(3, 9) * 100 : 0
  expenses.housing = random.int(30, 70) * 10
  expenses.food = random.int(15, 30) * 10
  expenses.transport = random.pick([0, 25, 35])
  expenses.communication = random.pick([10, 15, 20])
  return {
    monthlyIncomes: incomes,
    monthlyExpenses: expenses,
    incomeFrequencies: monthly(INCOME_TYPES),
    expenseFrequencies: monthly(EXPENSE_TYPES),
    activeIncomeTypes: INCOME_TYPES.filter((k) => incomes[k] > 0),
    activeExpenseTypes: EXPENSE_TYPES.filter((k) => expenses[k] > 0),
  }
}

async function seedStudentSpace(db: Db, ref: DemoReferential, students: Student[], random: Random, clock: Clock) {
  const published = ref.residences.filter((r) => r.published)
  const [account, ...others] = students

  // Favoris : 3 pour le compte nominatif, 0 à 3 pour les autres.
  const favorites: (typeof favoriteAccommodations.$inferInsert)[] = []
  for (const student of students) {
    const count = student.id === account.id ? 3 : random.int(0, 3)
    for (const residence of random.sample(published, count)) favorites.push({ userId: student.id, accommodationId: residence.id })
  }
  await db.insert(favoriteAccommodations).values(favorites)

  // Alertes : actives, expirées, et sur les trois niveaux de territoire.
  const alerts: (typeof studentAlerts.$inferInsert)[] = []
  for (const student of [account, ...random.sample(others, 15)]) {
    const target = random.pick(ref.cities)
    const level = random.weighted([
      ['city', 6],
      ['department', 2],
      ['academy', 1],
    ] as const)
    const renewedAt = clock.daysAgo(random.int(0, 120))
    const expired = random.chance(0.2)
    alerts.push({
      userId: student.id,
      name: `Logement à ${target.name}`,
      cityId: level === 'city' ? target.id : null,
      departmentId: level === 'department' ? target.departmentId : null,
      academyId: level === 'academy' ? target.academyId : null,
      maxPrice: random.int(40, 75) * 10,
      hasColiving: random.chance(0.2),
      isAccessible: random.chance(0.1),
      receiveNotifications: random.chance(0.7),
      createdAt: renewedAt,
      renewedAt,
      expiredAt: expired ? clock.daysAgo(random.int(0, 10)) : null,
    })
  }
  await db.insert(studentAlerts).values(alerts)

  // Simulations d'aides et de budget (une par étudiant au plus).
  const cityNames = ref.cities.map((c) => c.name)
  await db.insert(housingAidSimulations).values(
    [account, ...random.sample(others, 18)].map((student) => ({
      userId: student.id,
      inputs: {
        age: random.int(18, 26),
        status: [random.pick(['student', 'apprentice', 'employed-student', 'boursier-crous'] as const)],
        isInternationalStudent: random.chance(0.15),
        monthlyIncome: random.int(0, 12) * 100,
        monthlyRent: random.int(30, 70) * 10,
        rentUnknown: false,
        city: random.pick(cityNames),
        hasGuarantor: random.pick(['yes', 'no', 'unknown'] as const),
      },
      createdAt: clock.daysAgo(random.int(0, 150)),
    })),
  )
  await db.insert(budgetSimulations).values(
    [account, ...random.sample(others, 12)].map((student) => ({
      userId: student.id,
      inputs: budgetSimulation(random),
      createdAt: clock.daysAgo(random.int(0, 150)),
    })),
  )

  // Objectifs (« to-do » de l'espace étudiant).
  const GOALS = [
    'Constituer mon dossier DossierFacile',
    'Faire ma demande d’aide au logement',
    'Visiter deux résidences',
    'Demander une garantie Visale',
  ]
  for (const student of [account, ...random.sample(others, 6)]) {
    const [list] = await db
      .insert(studentGoalLists)
      .values({ userId: student.id, emailRemindersEnabled: random.chance(0.6) })
      .returning({ id: studentGoalLists.id })
    await db.insert(studentGoals).values(
      random.sample(GOALS, 3).map((title, position) => {
        const dueDelay = random.pick(['one_week', 'two_weeks', 'one_month'] as const)
        const createdAt = clock.daysAgo(random.int(1, 40))
        const days = dueDelay === 'one_week' ? 7 : dueDelay === 'two_weeks' ? 14 : 30
        return {
          listId: list.id,
          title,
          dueDelay,
          dueAt: clock.addDays(createdAt, days),
          position,
          completedAt: random.chance(0.4) ? clock.addDays(createdAt, random.int(0, days)) : null,
          createdAt,
        }
      }),
    )
  }
}

// ── Événements de suivi (sources des métriques mensuelles) ───────────────────

async function seedTrackingEvents(db: Db, ref: DemoReferential, students: Student[], random: Random, clock: Clock) {
  const published = ref.residences.filter((r) => r.published)
  const withLanding = [ref.owners.contacts, ref.owners.dossierFacile, ref.owners.none]
  const rows: (typeof trackingEvents.$inferInsert)[] = []
  const session = () => fakeHash(random).slice(0, 32)

  for (let day = HISTORY_DAYS; day >= 0; day--) {
    // Trafic en croissance sur la période, avec un creux le week-end.
    const growth = 0.5 + (HISTORY_DAYS - day) / HISTORY_DAYS
    const date = clock.daysAgo(day)
    const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6
    const volume = (base: number) => Math.round(base * growth * (weekend ? 0.6 : 1) * (0.7 + random.next() * 0.6))
    const at = () => clock.daysAgo(day + random.next() * 0.99)
    const userId = () => (random.chance(0.25) ? random.pick(students).id : null)

    for (let i = 0; i < volume(8); i++) {
      const target = random.pick(ref.cities)
      rows.push({
        type: 'search.city',
        cityId: target.id,
        departmentId: target.departmentId,
        userId: userId(),
        sessionId: session(),
        createdAt: at(),
      })
    }
    for (let i = 0; i < volume(1); i++) {
      rows.push({ type: 'search.department', departmentId: random.pick(ref.cities).departmentId, sessionId: session(), createdAt: at() })
    }
    for (let i = 0; i < volume(10); i++) {
      const residence = random.pick(published)
      const sessionId = session()
      const viewer = userId()
      const createdAt = at()
      rows.push({
        type: 'accommodation.viewed',
        accommodationId: residence.id,
        ownerId: residence.ownerId,
        cityId: residence.cityId,
        userId: viewer,
        sessionId,
        createdAt,
      })
      if (random.chance(0.3)) {
        rows.push({
          type: 'accommodation.consult_offer',
          accommodationId: residence.id,
          ownerId: residence.ownerId,
          cityId: residence.cityId,
          userId: viewer,
          sessionId,
          createdAt: new Date(createdAt.getTime() + 30_000),
        })
      }
    }
    for (let i = 0; i < volume(1); i++) {
      rows.push({ type: 'owner.landing_click', ownerId: random.pick(withLanding).id, sessionId: session(), createdAt: at() })
    }
  }

  // Les événements sont tous dans le passé, y compris pour « aujourd'hui ».
  const now = clock.now.getTime()
  await insertInBatches(
    rows.filter((row) => (row.createdAt as Date).getTime() < now),
    (chunk) => db.insert(trackingEvents).values(chunk),
  )
}

// ── Statistiques Matomo (normalement synchronisées par `sync stats`) ─────────

async function seedMatomoStats(db: Db, random: Random, clock: Clock) {
  const PAGES = [
    '/',
    '/trouver-un-logement-etudiant',
    '/simuler-mes-aides-au-logement',
    '/preparer-mon-budget-etudiant',
    '/trouver-un-logement-etudiant/ville/lyon',
    '/foire-aux-questions',
  ]
  const SOURCES = ['Moteurs de recherche', 'Entrée directe', 'Sites web', 'Réseaux sociaux', 'Campagnes']
  const EVENTS: [string, string[]][] = [
    ['simulator', ['stepper', 'results', 'cta']],
    ['student', ['favorites', 'alerts', 'profile']],
    ['search', ['title', 'description']],
  ]
  const statRows: (typeof stats.$inferInsert)[] = []
  const eventRows: (typeof eventStats.$inferInsert)[] = []

  for (let day = HISTORY_DAYS; day >= 1; day--) {
    const date = clock.isoDate(clock.daysAgo(day))
    const visitors = Math.round((300 + (HISTORY_DAYS - day) * 4) * (0.8 + random.next() * 0.4))
    const ranking = (labels: string[], total: number) =>
      labels.map((label, index) => ({ label, nbVisits: Math.max(1, Math.round((total / (index + 1.5)) * (0.8 + random.next() * 0.4))) }))
    statRows.push({
      date,
      uniqueVisitors: visitors,
      newVisitsPercentage: 55 + random.next() * 20,
      averageDuration: 90 + random.next() * 120,
      bounceRatePercentage: 35 + random.next() * 20,
      pageViews: Math.round(visitors * (2 + random.next())),
      visitorsPerPage: 1.5 + random.next(),
      topPages: ranking(PAGES, visitors),
      mainEntryPages: ranking(PAGES.slice(0, 4), visitors * 0.8),
      mainSources: ranking(SOURCES, visitors),
    })
    for (const [category, actions] of EVENTS) {
      for (const action of actions) {
        const nbEvents = Math.round(visitors * (0.02 + random.next() * 0.08))
        eventRows.push({ date, category, action, nbEvents, nbUniqueEvents: Math.round(nbEvents * 0.8), eventValue: null })
      }
    }
  }
  await insertInBatches(statRows, (chunk) => db.insert(stats).values(chunk))
  await insertInBatches(eventRows, (chunk) => db.insert(eventStats).values(chunk))
}

// ── Côté bailleurs ───────────────────────────────────────────────────────────

async function seedOwnerSide(db: Db, ref: DemoReferential, random: Random, clock: Clock) {
  const managed = [ref.owners.contacts, ref.owners.dossierFacile, ref.owners.none]

  // Journal d'activité des gestionnaires : mises à jour et confirmations de disponibilités.
  const logs: (typeof activityLog.$inferInsert)[] = []
  for (const owner of managed) {
    const residences = ref.residences.filter((r) => r.ownerId === owner.id)
    // Habitat Démo très actif, Campus Horizon presque inactif.
    const frequency = owner === ref.owners.contacts ? 0.35 : owner === ref.owners.dossierFacile ? 0.2 : 0.03
    for (let day = HISTORY_DAYS; day >= 0; day--) {
      if (!random.chance(frequency)) continue
      const residence = random.pick(residences)
      logs.push({
        createdAt: clock.daysAgo(day + random.next() * 0.9),
        userId: random.pick(owner.managerIds),
        userName: 'Gestionnaire démo',
        action: random.chance(0.6) ? 'accommodation.availability_updated' : 'accommodation.availability_confirmed',
        entityType: 'accommodation',
        entityId: String(residence.id),
        entityName: residence.name,
        ownerId: owner.id,
        ownerName: owner.name,
        metadata: { slug: residence.slug },
      })
    }
  }
  await insertInBatches(logs, (chunk) => db.insert(activityLog).values(chunk))

  // Enquête boursiers : réponses d'Habitat Démo (enquête complétée).
  const surveyed = ref.residences.filter((r) => r.ownerId === ref.owners.contacts.id && r.published)
  await db
    .insert(scholarshipSurveyAnswers)
    .values(
      surveyed.map((r, index) =>
        index === surveyed.length - 1
          ? { accommodationId: r.id, notMeasured: true, updatedByUserId: ref.owners.contacts.managerIds[0] }
          : { accommodationId: r.id, scholarshipRate: random.int(15, 45), updatedByUserId: ref.owners.contacts.managerIds[0] },
      ),
    )

  // Avis des gestionnaires sur l'outil.
  await db.insert(ownerFeedback).values([
    {
      userId: ref.owners.contacts.managerIds[0],
      status: 'submitted',
      rating: 5,
      comment: 'Avis fictif : outil pratique pour suivre les demandes.',
      createdAt: clock.daysAgo(40),
    },
    {
      userId: ref.owners.contacts.managerIds[1],
      status: 'submitted',
      rating: 3,
      comment: 'Avis fictif : il manque un export.',
      createdAt: clock.daysAgo(15),
    },
    { userId: ref.owners.none.managerIds[0], status: 'snoozed', createdAt: clock.daysAgo(5) },
  ])

  // Tentatives de connexion par lien magique.
  const attempts: (typeof loginAttempts.$inferInsert)[] = []
  for (let i = 0; i < 30; i++) {
    const owner = random.pick(managed)
    const createdAt = clock.daysAgo(random.int(0, 60) + random.next())
    const status = random.weighted([
      [ELoginAttemptStatus.COMPLETED, 7],
      [ELoginAttemptStatus.EMAIL_SENT, 2],
      [ELoginAttemptStatus.EXPIRED, 1],
    ] as const)
    attempts.push({
      createdAt,
      userId: random.pick(owner.managerIds),
      ownerId: owner.id,
      role: 'owner',
      tokenHash: fakeHash(random),
      expiresAt: new Date(createdAt.getTime() + 10 * 60_000),
      status,
      verifiedAt: status === ELoginAttemptStatus.EMAIL_SENT ? null : new Date(createdAt.getTime() + random.int(1, 20) * 60_000),
      ipHash: fakeHash(random),
    })
  }
  await db.insert(loginAttempts).values(attempts)
}

// ── Support et signalements ─────────────────────────────────────────────────

async function seedSupport(db: Db, ref: DemoReferential, students: Student[], random: Random, clock: Clock) {
  const CATEGORIES = ['search', 'contact_request', 'student_space', 'simulators', 'account', 'other'] as const
  await db.insert(supportTickets).values(
    random.sample(students, 10).map((student, index) => ({
      userId: student.id,
      category: CATEGORIES[index % CATEGORIES.length],
      message: `Message fictif n°${index + 1} : question d'un étudiant sur la plateforme.`,
      status: random.pick(['open', 'in_progress', 'resolved'] as const),
      createdAt: clock.daysAgo(random.int(0, 90)),
    })),
  )

  const FIELDS = ['price', 'availability', 'address', 'contact', 'other']
  await db.insert(accommodationReports).values(
    random
      .sample(
        ref.residences.filter((r) => r.published),
        6,
      )
      .map((residence, index) => ({
        accommodationId: residence.id,
        field: FIELDS[index % FIELDS.length],
        details: 'Signalement fictif : information à vérifier.',
        ipHash: fakeHash(random),
        status: random.pick(['open', 'in_progress', 'resolved'] as const),
        createdAt: clock.daysAgo(random.int(0, 60)),
      })),
  )
}

// ── Plateforme : imports, crons, API ─────────────────────────────────────────

async function seedPlatform(db: Db, ref: DemoReferential, random: Random, clock: Clock) {
  const JOBS: [TImportJobType, number][] = [
    ['sync-stats', 1],
    ['alert-detection', 1],
    ['contact-digest', 1],
    ['purge-contacts', 1],
    ['availability-recap', 30],
    ['monthly-metrics', 1],
    ['csv', 14],
  ]
  const jobs: (typeof importJobs.$inferInsert)[] = []
  for (const [type, everyDays] of JOBS) {
    for (let day = 30; day >= 1; day -= everyDays) {
      const startedAt = clock.daysAgo(day - 0.1)
      const failed = random.chance(0.05)
      jobs.push({
        type,
        status: failed ? 'error' : 'done',
        source: type,
        createdBy: type === 'csv' ? ref.adminIds[0] : 'cron',
        startedAt,
        endedAt: new Date(startedAt.getTime() + random.int(5, 300) * 1000),
        createdAt: startedAt,
        updatedAt: startedAt,
        summary: failed ? { errors: ['Erreur fictive : service distant indisponible.'] } : { updated: random.int(0, 50) },
      })
    }
  }
  await insertInBatches(jobs, (chunk) => db.insert(importJobs).values(chunk))

  // Consommateur de l'API publique, rattaché à Habitat Démo. La clé stockée est une empreinte
  // factice : elle ne permet aucun appel réel.
  const [key] = await db
    .insert(apikey)
    .values({
      id: 'seed-api-key-partenaire',
      name: 'Partenaire Démo',
      start: 'mle_demo',
      prefix: 'mle_',
      key: fakeHash(random),
      referenceId: ref.adminIds[0],
      enabled: true,
      requestCount: 0,
      createdAt: clock.daysAgo(90),
    })
    .returning({ id: apikey.id })
  await db.insert(apiKeyOwners).values({ apiKeyId: key.id, ownerId: ref.owners.contacts.id })
  const usage: (typeof apiKeyUsageDaily.$inferInsert)[] = []
  for (let day = 60; day >= 1; day--) {
    if (random.chance(0.8)) usage.push({ apiKeyId: key.id, day: clock.isoDate(clock.daysAgo(day)), count: random.int(20, 400) })
  }
  await db.insert(apiKeyUsageDaily).values(usage)
}
