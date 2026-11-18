import { loadAvailabilityByOwner, loadAvailabilityFollowUp, loadAvailabilitySnapshotSeries } from '~/server/admin/availability-follow-up'
import { adminProcedure, createTRPCRouter } from '../init'

export const adminAvailabilityRouter = createTRPCRouter({
  followUp: adminProcedure.query(() => loadAvailabilityFollowUp()),
  byOwner: adminProcedure.query(() => loadAvailabilityByOwner()),
  snapshots: adminProcedure.query(() => loadAvailabilitySnapshotSeries()),
})
