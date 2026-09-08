import { describe, expect, it } from 'vitest'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import {
  BAILLEUR_PERMISSIONS,
  canEditOwnAccount,
  canGrantApplicationsPermission,
  DEFAULT_GESTIONNAIRE_PERMISSIONS,
  grantablePermissions,
  hasPermission,
  hasRole,
  isBailleurAdministrator,
  MAX_BAILLEUR_ADMINISTRATORS,
  type PermissionCheckUser,
  sanitizeGestionnairePermissions,
} from '~/server/bailleur/permissions'

const admin: PermissionCheckUser = { role: 'admin', bailleurRole: null, bailleurPermissions: [] }
const administrator: PermissionCheckUser = { role: 'owner', bailleurRole: 'administrator', bailleurPermissions: [] }
const gestionnaireWithResidences: PermissionCheckUser = {
  role: 'owner',
  bailleurRole: 'gestionnaire',
  bailleurPermissions: ['manage_residences'],
}
const gestionnaireEmpty: PermissionCheckUser = { role: 'owner', bailleurRole: 'gestionnaire', bailleurPermissions: [] }
const student: PermissionCheckUser = { role: 'user', bailleurRole: null, bailleurPermissions: [] }

describe('hasRole', () => {
  it('platform admin is every role', () => {
    expect(hasRole(admin, 'administrator')).toBe(true)
    expect(hasRole(admin, 'gestionnaire')).toBe(true)
  })

  it('matches exact bailleur role', () => {
    expect(hasRole(administrator, 'administrator')).toBe(true)
    expect(hasRole(administrator, 'gestionnaire')).toBe(false)
    expect(hasRole(gestionnaireEmpty, 'gestionnaire')).toBe(true)
    expect(hasRole(gestionnaireEmpty, 'administrator')).toBe(false)
  })

  it('student has no bailleur role', () => {
    expect(hasRole(student, 'administrator')).toBe(false)
    expect(hasRole(student, 'gestionnaire')).toBe(false)
  })
})

describe('hasPermission', () => {
  it('platform admin has every permission', () => {
    expect(hasPermission(admin, 'manage_applications')).toBe(true)
    expect(hasPermission(admin, 'manage_residences')).toBe(true)
  })

  it('administrator has every permission implicitly', () => {
    expect(hasPermission(administrator, 'manage_residences')).toBe(true)
    expect(hasPermission(administrator, 'manage_applications')).toBe(true)
  })

  it('gestionnaire has only listed permissions', () => {
    expect(hasPermission(gestionnaireWithResidences, 'manage_residences')).toBe(true)
    expect(hasPermission(gestionnaireWithResidences, 'manage_applications')).toBe(false)
  })

  it('gestionnaire with empty permissions has none', () => {
    expect(hasPermission(gestionnaireEmpty, 'manage_residences')).toBe(false)
    expect(hasPermission(gestionnaireEmpty, 'manage_applications')).toBe(false)
  })

  it('student has no permissions', () => {
    expect(hasPermission(student, 'manage_residences')).toBe(false)
  })
})

describe('isBailleurAdministrator', () => {
  it('is true for a platform admin', () => {
    expect(isBailleurAdministrator(admin)).toBe(true)
  })

  it('is true for a bailleur administrator', () => {
    expect(isBailleurAdministrator(administrator)).toBe(true)
  })

  it('is false for a gestionnaire, whatever its permissions', () => {
    expect(isBailleurAdministrator(gestionnaireWithResidences)).toBe(false)
    expect(isBailleurAdministrator(gestionnaireEmpty)).toBe(false)
  })
})

describe('canEditOwnAccount', () => {
  it('allows administrators and platform admins', () => {
    expect(canEditOwnAccount(administrator)).toBe(true)
    expect(canEditOwnAccount(admin)).toBe(true)
  })

  it('refuses a gestionnaire, whatever its permissions', () => {
    expect(canEditOwnAccount(gestionnaireEmpty)).toBe(false)
    expect(canEditOwnAccount(gestionnaireWithResidences)).toBe(false)
  })
})

describe('constantes de retrogradation', () => {
  it('plafonne les administrateurs a 2', () => {
    expect(MAX_BAILLEUR_ADMINISTRATORS).toBe(2)
  })

  it('les permissions par defaut du gestionnaire couvrent candidats et residences', () => {
    expect([...DEFAULT_GESTIONNAIRE_PERMISSIONS].sort()).toEqual(['manage_applications', 'manage_residences'])
  })
})

describe('enum des permissions', () => {
  it("la gestion des utilisateurs n'est pas une permission : elle decoule du role", () => {
    expect(BAILLEUR_PERMISSIONS).toEqual(['manage_residences', 'manage_applications'])
  })

  it('les disponibilites sont couvertes par manage_residences', () => {
    expect(BAILLEUR_PERMISSIONS).not.toContain('manage_availability')
  })
})

describe('parcours de candidature', () => {
  it('manage_applications exige un parcours choisi', () => {
    expect(canGrantApplicationsPermission(EOwnerContactMode.NONE)).toBe(false)
    expect(canGrantApplicationsPermission(EOwnerContactMode.CONTACTS)).toBe(true)
    expect(canGrantApplicationsPermission(EOwnerContactMode.DOSSIER_FACILE)).toBe(true)
  })

  it('grantablePermissions masque manage_applications sans parcours', () => {
    expect(grantablePermissions(EOwnerContactMode.NONE)).toEqual(['manage_residences'])
    expect(grantablePermissions(EOwnerContactMode.CONTACTS)).toEqual(['manage_residences', 'manage_applications'])
  })

  it('sanitize retire manage_applications sans parcours et la conserve sinon', () => {
    expect(sanitizeGestionnairePermissions(['manage_residences', 'manage_applications'], EOwnerContactMode.NONE)).toEqual([
      'manage_residences',
    ])
    expect(sanitizeGestionnairePermissions(['manage_residences', 'manage_applications'], EOwnerContactMode.DOSSIER_FACILE)).toEqual([
      'manage_residences',
      'manage_applications',
    ])
  })
})
