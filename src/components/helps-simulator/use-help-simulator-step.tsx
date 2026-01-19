import { parseAsInteger, useQueryState } from 'nuqs'

export const useHelpSimulatorStep = () => useQueryState('step', parseAsInteger.withDefault(1))
