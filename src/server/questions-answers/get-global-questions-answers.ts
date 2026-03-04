import { getQueryClient, trpc } from '~/server/trpc/server'

export const getGlobalQuestionsAnswers = () => getQueryClient().fetchQuery(trpc.questionsAnswers.getGlobal.queryOptions())
