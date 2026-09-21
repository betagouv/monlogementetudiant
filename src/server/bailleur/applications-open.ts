type ApplicationsState = { acceptsApplications: boolean; applicationsSuspendedAt: Date | null }

export const isOpenToApplications = (row: ApplicationsState) => row.acceptsApplications && row.applicationsSuspendedAt === null
