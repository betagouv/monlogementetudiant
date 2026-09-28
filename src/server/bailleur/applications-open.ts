type ApplicationsState = { acceptsApplications: boolean; applicationsSuspendedAt: Date | null }

export const isOpenToApplications = (row: ApplicationsState) => row.acceptsApplications && row.applicationsSuspendedAt === null

type ContactRequestAvailability = { nbAvailableApartments: number | null; acceptWaitingList: boolean | null }

/**
 * Bouton « Être recontacté » : ouvert quand la résidence a des disponibilités, ou quand elle est
 * complète mais accepte la liste d'attente. Une disponibilité inconnue compte comme « complète ».
 */
export const acceptsContactRequests = ({ nbAvailableApartments, acceptWaitingList }: ContactRequestAvailability) =>
  (nbAvailableApartments ?? 0) > 0 || acceptWaitingList === true
