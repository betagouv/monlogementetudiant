import type { TaskList } from 'graphile-worker'
import { brevoUnblockManagersTask } from './brevo-unblock-managers'
import { detectAlertsTask } from './detect-alerts'
import { reportAlertFailuresTask } from './report-alert-failures'
import { requeuePendingAlertsTask } from './requeue-pending-alerts'
import { runCliCommand } from './run-cli-command'
import { sendAlertBatchTask } from './send-alert-batch'

export const taskList: TaskList = {
  'run-cli-command': runCliCommand,
  'send-alert-batch': sendAlertBatchTask,
  'detect-alerts': detectAlertsTask,
  'requeue-pending-alerts': requeuePendingAlertsTask,
  'report-alert-failures': reportAlertFailuresTask,
  'brevo-unblock-managers': brevoUnblockManagersTask,
}
