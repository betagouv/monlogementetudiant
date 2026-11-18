import {
  loadAvailabilityByOwner,
  loadAvailabilityFollowUp,
  loadAvailabilitySnapshotRows,
  loadFollowUpAdmins,
} from '~/server/admin/availability-follow-up'
import { adminProcedure, createTRPCRouter } from '../init'

export const adminAvailabilityRouter = createTRPCRouter({
  followUp: adminProcedure.query(() => loadAvailabilityFollowUp()),
  byOwner: adminProcedure.query(() => loadAvailabilityByOwner()),
  admins: adminProcedure.query(() => loadFollowUpAdmins()),
  snapshots: adminProcedure.query(() => loadAvailabilitySnapshotRows()),
})
