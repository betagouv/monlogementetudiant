import { beforeEach, describe, expect, it } from 'vitest'
import { EStudyYear } from '~/enums/study-year'
import { createUser } from './fixtures/factories'
import './helpers/setup-integration'
import { authenticatedCaller } from './helpers/test-caller'

beforeEach(async () => {
  await createUser({ id: 'test-user-id', email: 'test@test.com', name: 'Test User' })
})

const baseInput = { firstname: 'Camille', lastname: 'Durand' }

describe('student.updateProfile — champs d’études', () => {
  it('persiste alternance, établissement et année, relus par getProfile', async () => {
    await authenticatedCaller.student.updateProfile({
      ...baseInput,
      isWorkStudy: true,
      studyInstitution: '  Université de Lille ',
      studyYear: EStudyYear.BAC_3,
    })

    const profile = await authenticatedCaller.student.getProfile()
    expect(profile).toMatchObject({ isWorkStudy: true, studyInstitution: 'Université de Lille', studyYear: 'bac_3' })
  })

  it('stocke null quand les champs sont absents ou vides', async () => {
    await authenticatedCaller.student.updateProfile({
      ...baseInput,
      isWorkStudy: false,
      studyInstitution: 'IUT',
      studyYear: EStudyYear.BAC_1,
    })
    await authenticatedCaller.student.updateProfile({ ...baseInput, studyInstitution: '   ' })

    const profile = await authenticatedCaller.student.getProfile()
    expect(profile).toMatchObject({ isWorkStudy: null, studyInstitution: null, studyYear: null })
  })

  it('rejette un établissement de plus de 200 caractères', async () => {
    await expect(authenticatedCaller.student.updateProfile({ ...baseInput, studyInstitution: 'a'.repeat(201) })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
  })
})
