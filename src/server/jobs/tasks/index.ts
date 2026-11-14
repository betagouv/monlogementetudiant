import type { Task, TaskList } from 'graphile-worker'
import type { TJobIdentifier } from '~/server/jobs/enqueue'
import { brevoUnblockManagersTask } from './brevo-unblock-managers'
import { detectAlertsTask } from './detect-alerts'
import { graphileCleanupTask } from './graphile-cleanup'
import { reportAlertFailuresTask } from './report-alert-failures'
import { requeuePendingAlertsTask } from './requeue-pending-alerts'
import { runCliCommand } from './run-cli-command'
import { sendAlertBatchTask } from './send-alert-batch'

export const taskList = {
  'run-cli-command': runCliCommand,
  'send-alert-batch': sendAlertBatchTask,
  'detect-alerts': detectAlertsTask,
  'requeue-pending-alerts': requeuePendingAlertsTask,
  'report-alert-failures': reportAlertFailuresTask,
  'brevo-unblock-managers': brevoUnblockManagersTask,
  'graphile-cleanup': graphileCleanupTask,
} satisfies TaskList & Record<TJobIdentifier, Task>
