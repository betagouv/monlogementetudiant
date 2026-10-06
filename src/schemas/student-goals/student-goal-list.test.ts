import { describe, expect, it } from 'vitest'
import { EStudentGoalDueDelay } from '~/enums/student-goal'
import {
  STUDENT_GOAL_TITLE_MAX_LENGTH,
  STUDENT_GOALS_MAX_PER_LIST,
  ZStudentGoalListCreate,
  ZStudentGoalListUpdate,
} from './student-goal-list'

const validGoal = { title: 'Candidater dans 3 résidences à Nantes', dueDelay: EStudentGoalDueDelay.ONE_WEEK }
const validInput = { emailRemindersEnabled: true, goals: [validGoal] }

describe('ZStudentGoalListCreate', () => {
  it('accepte une entrée valide', () => {
    const result = ZStudentGoalListCreate.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('accepte plusieurs objectifs avec des échéances différentes', () => {
    const result = ZStudentGoalListCreate.safeParse({
      emailRemindersEnabled: false,
      goals: [
        validGoal,
        { title: 'Ajouter 3 résidences en favoris à Lille', dueDelay: EStudentGoalDueDelay.TWO_WEEKS },
        { title: 'Créer une alerte logement', dueDelay: EStudentGoalDueDelay.ONE_MONTH },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejette une liste sans objectif avec un message FR', () => {
    const result = ZStudentGoalListCreate.safeParse({ ...validInput, goals: [] })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Veuillez ajouter au moins un objectif')
    }
  })

  it('rejette un objectif au titre vide avec un message FR', () => {
    const result = ZStudentGoalListCreate.safeParse({ ...validInput, goals: [{ ...validGoal, title: '' }] })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Veuillez saisir votre objectif')
    }
  })

  it('compte la longueur après trim (espaces seuls insuffisants)', () => {
    expect(ZStudentGoalListCreate.safeParse({ ...validInput, goals: [{ ...validGoal, title: '   ' }] }).success).toBe(false)
  })

  it('nettoie les espaces en bordure du titre', () => {
    const result = ZStudentGoalListCreate.safeParse({ ...validInput, goals: [{ ...validGoal, title: '  Mon objectif  ' }] })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.goals[0].title).toBe('Mon objectif')
  })

  it('rejette un titre au-delà de la limite max', () => {
    const result = ZStudentGoalListCreate.safeParse({
      ...validInput,
      goals: [{ ...validGoal, title: 'a'.repeat(STUDENT_GOAL_TITLE_MAX_LENGTH + 1) }],
    })
    expect(result.success).toBe(false)
  })

  it('rejette une liste dépassant le nombre maximal d’objectifs', () => {
    const result = ZStudentGoalListCreate.safeParse({
      ...validInput,
      goals: Array.from({ length: STUDENT_GOALS_MAX_PER_LIST + 1 }, (_, index) => ({ ...validGoal, title: `Objectif ${index}` })),
    })
    expect(result.success).toBe(false)
  })

  it('rejette une échéance inconnue', () => {
    expect(ZStudentGoalListCreate.safeParse({ ...validInput, goals: [{ ...validGoal, dueDelay: 'demain' }] }).success).toBe(false)
  })
})

describe('ZStudentGoalListUpdate', () => {
  it('accepte une entrée valide avec identifiants d’objectifs conservés', () => {
    const result = ZStudentGoalListUpdate.safeParse({ ...validInput, listId: 1, goals: [{ ...validGoal, id: 12 }] })
    expect(result.success).toBe(true)
  })

  it('rejette une entrée sans listId', () => {
    expect(ZStudentGoalListUpdate.safeParse(validInput).success).toBe(false)
  })
})
