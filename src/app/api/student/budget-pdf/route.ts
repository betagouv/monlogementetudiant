import { renderToBuffer } from '@react-pdf/renderer'
import { eq } from 'drizzle-orm'
import { getLocale, getTranslations } from 'next-intl/server'
import { canAccessStudentSpace } from '~/lib/roles'
import { ZBudgetSimulation } from '~/schemas/budget-simulation'
import { BudgetPdf, type TBudgetPdfLabels } from '~/server/budget-pdf/budget-pdf'
import { budgetPdfFileName, buildBudgetPdfData, formatPdfAmount } from '~/server/budget-pdf/budget-pdf-data'
import { db } from '~/server/db'
import { budgetSimulations } from '~/server/db/schema'
import { getServerSession } from '~/services/better-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession()
  if (!session) return new Response('Unauthorized', { status: 401 })
  if (!canAccessStudentSpace(session.user.role)) return new Response('Forbidden', { status: 403 })

  const [row] = await db
    .select({ inputs: budgetSimulations.inputs })
    .from(budgetSimulations)
    .where(eq(budgetSimulations.userId, session.user.id))
  if (!row) return new Response('Not found', { status: 404 })

  const parsed = ZBudgetSimulation.safeParse(row.inputs)
  if (!parsed.success) return new Response('Invalid budget simulation', { status: 422 })

  const [t, tHeader, locale] = await Promise.all([getTranslations('budgetSimulator'), getTranslations('header'), getLocale()])
  const data = buildBudgetPdfData(parsed.data)
  const now = new Date()
  const savingsRate =
    data.savingsRate === null
      ? null
      : t('summary.savingsRate', { rate: new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(data.savingsRate) })

  const labels: TBudgetPdfLabels = {
    republic: t('pdf.republic'),
    motto: t('pdf.motto'),
    serviceName: tHeader('title'),
    serviceTagline: tHeader('description'),
    title: t('pdf.title'),
    generatedOn: t('pdf.generatedOn', { date: new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(now) }),
    totalIncome: t('summary.totalIncome'),
    totalExpenses: t('summary.totalExpenses'),
    annualTotal: t('summary.annualTotal', { amount: formatPdfAmount(data.totalExpenses * 12) }),
    remainingBalance: t('summary.remainingBalance'),
    savingsRate,
    incomesTitle: t('pdf.incomesTitle'),
    expensesTitle: t('pdf.expensesTitle'),
    distributionTitle: t('pdf.distributionTitle'),
    columnCategory: t('pdf.columnCategory'),
    columnFrequency: t('pdf.columnFrequency'),
    columnAmount: t('pdf.columnAmount'),
    columnMonthly: t('pdf.columnMonthly'),
    total: t('pdf.total'),
    empty: t('pdf.empty'),
    disclaimer: t('pdf.disclaimer'),
    frequencies: t.raw('expenses.frequencies'),
    incomeTypes: t.raw('income.types'),
    expenseTypes: t.raw('expenses.types'),
  }

  const pdf = await renderToBuffer(BudgetPdf({ data, labels }))

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${budgetPdfFileName(now)}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
