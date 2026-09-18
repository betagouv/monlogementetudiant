import type { BadgeProps } from '@codegouvfr/react-dsfr/Badge'
import { z } from 'zod'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'

/**
 * Vocabulaire de statut partagé entre les candidatures DossierFacile
 * (`dossier_facile_application.status`) et les demandes de contact
 * (`contact_request.status`). Stocké en `text` libre, validé par `ZContactStatus`.
 */
export enum EContactStatus {
  A_MODERER = 'a_moderer',
  A_CONTACTER = 'a_contacter',
  CONTACTE = 'contacte',
  NON_RETENU = 'non_retenu',
}

export const CONTACT_STATUSES = Object.values(EContactStatus)

export const ZContactStatus = z.enum(EContactStatus)

/** Le libellé affiché est traduit via `bailleur.contacts.status.<statut>`. */
interface StatusConfig {
  /** Sévérité DSFR du Badge, ou `null` pour un rendu gris neutre (non retenu). */
  severity: BadgeProps['severity'] | null
  /** Couleur de la bordure basse de la carte. */
  barColor: string
}

export const CONTACT_STATUS_CONFIG: Record<EContactStatus, StatusConfig> = {
  [EContactStatus.A_MODERER]: { severity: 'new', barColor: '#c3992a' },
  [EContactStatus.NON_RETENU]: { severity: null, barColor: '#929292' },
  [EContactStatus.A_CONTACTER]: { severity: 'error', barColor: '#e1000f' },
  [EContactStatus.CONTACTE]: { severity: 'success', barColor: '#18753c' },
}

/** Colonnes du board selon le mode (ordre d'affichage = ordre des écrans). */
export const DF_COLUMNS: readonly EContactStatus[] = [
  EContactStatus.A_MODERER,
  EContactStatus.NON_RETENU,
  EContactStatus.A_CONTACTER,
  EContactStatus.CONTACTE,
]
export const CONTACTS_COLUMNS: readonly EContactStatus[] = [EContactStatus.A_CONTACTER, EContactStatus.NON_RETENU, EContactStatus.CONTACTE]

/** Statut « à rappeler » compté dans le badge des cartes résidence. */
export const A_RAPPELER_STATUS: EContactStatus = EContactStatus.A_CONTACTER

/** Durée de conservation des coordonnées d'une demande de contact, à compter de son dépôt (jours). */
export const CONTACT_RETENTION_DAYS = 30

/**
 * Délai au-delà duquel une demande visiteur jamais confirmée par double opt-in est supprimée.
 * Ces lignes n'ont jamais été visibles de personne : rien à conserver.
 */
export const UNCONFIRMED_CONTACT_RETENTION_DAYS = 7

export const columnsForMode = (mode: EOwnerContactMode.CONTACTS | EOwnerContactMode.DOSSIER_FACILE): readonly EContactStatus[] =>
  mode === EOwnerContactMode.DOSSIER_FACILE ? DF_COLUMNS : CONTACTS_COLUMNS
