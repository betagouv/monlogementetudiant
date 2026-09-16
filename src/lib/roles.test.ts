import { describe, expect, it } from 'vitest'
import { canAccessOwnerSpace, canAccessStudentSpace } from './roles'

describe('accès aux espaces par rôle', () => {
  it('ouvre l’espace bailleur aux bailleurs et admins seulement', () => {
    expect(canAccessOwnerSpace('owner')).toBe(true)
    expect(canAccessOwnerSpace('admin')).toBe(true)
    expect(canAccessOwnerSpace('user')).toBe(false)
  })

  it('ouvre l’espace étudiant aux étudiants et admins seulement', () => {
    expect(canAccessStudentSpace('user')).toBe(true)
    expect(canAccessStudentSpace('admin')).toBe(true)
    expect(canAccessStudentSpace('owner')).toBe(false)
  })

  it('refuse un rôle inconnu ou absent partout', () => {
    for (const role of ['moderator', '', null, undefined]) {
      expect(canAccessOwnerSpace(role)).toBe(false)
      expect(canAccessStudentSpace(role)).toBe(false)
    }
  })
})
