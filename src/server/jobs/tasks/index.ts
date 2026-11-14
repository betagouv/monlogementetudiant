import type { TaskList } from 'graphile-worker'
import { runCliCommand } from './run-cli-command'

export const taskList: TaskList = {
  'run-cli-command': runCliCommand,
}
