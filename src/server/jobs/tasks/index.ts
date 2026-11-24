import type { Task, TaskList } from 'graphile-worker'
import type { TJobIdentifier } from '~/server/jobs/enqueue'
import { detectAlertsTask } from './detect-alerts'
import { graphileCleanupTask } from './graphile-cleanup'
import { reportAlertFailuresTask } from './report-alert-failures'
import { requeuePendingAlertsTask } from './requeue-pending-alerts'
import { runCliCommand } from './run-cli-command'
import { sendAlertBatchTask } from './send-alert-batch'
import { syncBrevoBlockedManagersTask } from './sync-brevo-blocked-managers'

export const taskList = {
  'run-cli-command': runCliCommand,
  'send-alert-batch': sendAlertBatchTask,
  'detect-alerts': detectAlertsTask,
  'requeue-pending-alerts': requeuePendingAlertsTask,
  'report-alert-failures': reportAlertFailuresTask,
  'sync-brevo-blocked-managers': syncBrevoBlockedManagersTask,
  'graphile-cleanup': graphileCleanupTask,
} satisfies TaskList & Record<TJobIdentifier, Task>
