import path from 'node:path'
import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { TBudgetFrequency } from '~/schemas/budget-simulation'
import { formatPdfAmount, formatPdfPercent, type TBudgetPdfData, type TBudgetPdfLine } from '~/server/budget-pdf/budget-pdf-data'

const FONTS_DIR = path.join(process.cwd(), 'node_modules/@codegouvfr/react-dsfr/dsfr/fonts')

function registerMarianneFont(): boolean {
  try {
    Font.register({
      family: 'Marianne',
      fonts: [
        { src: path.join(FONTS_DIR, 'Marianne-Regular.woff') },
        { src: path.join(FONTS_DIR, 'Marianne-Bold.woff'), fontWeight: 'bold' },
        { src: path.join(FONTS_DIR, 'Marianne-Regular_Italic.woff'), fontStyle: 'italic' },
      ],
    })
    Font.registerHyphenationCallback((word) => [word])
    return true
  } catch {
    return false
  }
}

const FONT_FAMILY = registerMarianneFont() ? 'Marianne' : 'Helvetica'

const BLUE_FRANCE = '#000091'
const RED_MARIANNE = '#e1000f'
const GREY_TEXT = '#666666'
const BORDER = '#dddddd'
const INCOME_COLOR = '#18753c'
const EXPENSE_COLOR = '#ce0500'

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 56, fontFamily: FONT_FAMILY, fontSize: 10, color: '#161616', lineHeight: 1.4 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  marque: { marginRight: 16 },
  band: { flexDirection: 'row', width: 36, height: 3, marginBottom: 4 },
  republic: { fontSize: 8, fontWeight: 'bold', lineHeight: 1.15 },
  motto: { fontSize: 6, fontStyle: 'italic', color: '#3a3a3a', marginTop: 3, lineHeight: 1.2 },
  service: { justifyContent: 'center', paddingTop: 6 },
  serviceName: { fontSize: 12, fontWeight: 'bold' },
  serviceTagline: { fontSize: 8, color: GREY_TEXT },
  title: { fontSize: 18, fontWeight: 'bold', lineHeight: 1.3, marginBottom: 4 },
  subtitle: { fontSize: 9, color: GREY_TEXT, marginBottom: 20 },
  kpis: { flexDirection: 'row', marginBottom: 20, borderWidth: 1, borderColor: BORDER },
  kpi: { flex: 1, padding: 10, alignItems: 'center' },
  kpiSeparator: { borderLeftWidth: 1, borderLeftColor: BORDER },
  kpiLabel: { fontSize: 8, color: GREY_TEXT, marginBottom: 4, textAlign: 'center' },
  kpiValue: { fontSize: 14, fontWeight: 'bold' },
  kpiHint: { fontSize: 7, color: GREY_TEXT, marginTop: 2, textAlign: 'center' },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: BORDER },
  tableHeader: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: BORDER },
  tableHeaderCell: { fontSize: 8, color: GREY_TEXT, fontWeight: 'bold' },
  row: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#eeeeee' },
  totalRow: { flexDirection: 'row', paddingVertical: 5 },
  colLabel: { flex: 3, paddingRight: 8 },
  colFrequency: { flex: 1.2 },
  colAmount: { flex: 1.2, textAlign: 'right' },
  colMonthly: { flex: 1.4, textAlign: 'right' },
  bold: { fontWeight: 'bold' },
  empty: { color: GREY_TEXT, fontStyle: 'italic', paddingVertical: 4 },
  shareRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  shareLabel: { width: '40%', paddingRight: 8, fontSize: 9 },
  shareTrack: { flex: 1, height: 8, backgroundColor: '#eeeeee' },
  shareBar: { height: 8, backgroundColor: BLUE_FRANCE },
  shareValue: { width: 90, textAlign: 'right', fontSize: 9 },
  disclaimer: { fontSize: 8, color: GREY_TEXT, marginTop: 8 },
  pagination: { position: 'absolute', bottom: 24, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: GREY_TEXT },
})

export type TBudgetPdfLabels = {
  republic: string
  motto: string
  serviceName: string
  serviceTagline: string
  title: string
  generatedOn: string
  totalIncome: string
  totalExpenses: string
  annualTotal: string
  remainingBalance: string
  savingsRate: string | null
  incomesTitle: string
  expensesTitle: string
  distributionTitle: string
  columnCategory: string
  columnFrequency: string
  columnAmount: string
  columnMonthly: string
  total: string
  empty: string
  disclaimer: string
  frequencies: Record<TBudgetFrequency, string>
  incomeTypes: Record<string, string>
  expenseTypes: Record<string, string>
}

function MarqueEtat({ labels }: { labels: TBudgetPdfLabels }) {
  return (
    <View style={styles.header} fixed>
      <View style={styles.marque}>
        <View style={styles.band}>
          <View style={{ flex: 1, backgroundColor: BLUE_FRANCE }} />
          <View style={{ flex: 1, backgroundColor: '#ffffff' }} />
          <View style={{ flex: 1, backgroundColor: RED_MARIANNE }} />
        </View>
        <Text style={styles.republic}>{labels.republic}</Text>
        <Text style={styles.motto}>{labels.motto}</Text>
      </View>
      <View style={styles.service}>
        <Text style={styles.serviceName}>{labels.serviceName}</Text>
        <Text style={styles.serviceTagline}>{labels.serviceTagline}</Text>
      </View>
    </View>
  )
}

function LinesTable<T extends string>({
  title,
  lines,
  total,
  typeLabels,
  labels,
  color,
}: {
  title: string
  lines: TBudgetPdfLine<T>[]
  total: number
  typeLabels: Record<string, string>
  labels: TBudgetPdfLabels
  color: string
}) {
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {lines.length === 0 ? (
        <Text style={styles.empty}>{labels.empty}</Text>
      ) : (
        <>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colLabel]}>{labels.columnCategory}</Text>
            <Text style={[styles.tableHeaderCell, styles.colFrequency]}>{labels.columnFrequency}</Text>
            <Text style={[styles.tableHeaderCell, styles.colAmount]}>{labels.columnAmount}</Text>
            <Text style={[styles.tableHeaderCell, styles.colMonthly]}>{labels.columnMonthly}</Text>
          </View>
          {lines.map((line) => (
            <View key={line.type} style={styles.row}>
              <Text style={styles.colLabel}>{typeLabels[line.type] ?? line.type}</Text>
              <Text style={styles.colFrequency}>{labels.frequencies[line.frequency]}</Text>
              <Text style={styles.colAmount}>{formatPdfAmount(line.amount)}</Text>
              <Text style={styles.colMonthly}>{formatPdfAmount(line.monthly)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={[styles.colLabel, styles.bold]}>{labels.total}</Text>
            <Text style={styles.colFrequency} />
            <Text style={styles.colAmount} />
            <Text style={[styles.colMonthly, styles.bold, { color }]}>{formatPdfAmount(total)}</Text>
          </View>
        </>
      )}
    </View>
  )
}

export function BudgetPdf({ data, labels }: { data: TBudgetPdfData; labels: TBudgetPdfLabels }) {
  const balanceColor = data.remainingBalance >= 0 ? INCOME_COLOR : EXPENSE_COLOR

  return (
    <Document title={labels.title} author={labels.serviceName} language="fr">
      <Page size="A4" style={styles.page}>
        <MarqueEtat labels={labels} />
        <Text style={styles.title}>{labels.title}</Text>
        <Text style={styles.subtitle}>{labels.generatedOn}</Text>

        <View style={styles.kpis} wrap={false}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>{labels.totalIncome}</Text>
            <Text style={[styles.kpiValue, { color: INCOME_COLOR }]}>{formatPdfAmount(data.totalIncomes)}</Text>
          </View>
          <View style={[styles.kpi, styles.kpiSeparator]}>
            <Text style={styles.kpiLabel}>{labels.totalExpenses}</Text>
            <Text style={[styles.kpiValue, { color: EXPENSE_COLOR }]}>{formatPdfAmount(data.totalExpenses)}</Text>
            <Text style={styles.kpiHint}>{labels.annualTotal}</Text>
          </View>
          <View style={[styles.kpi, styles.kpiSeparator]}>
            <Text style={styles.kpiLabel}>{labels.remainingBalance}</Text>
            <Text style={[styles.kpiValue, { color: balanceColor }]}>
              {data.remainingBalance >= 0 ? '+' : ''}
              {formatPdfAmount(data.remainingBalance)}
            </Text>
            {labels.savingsRate && <Text style={styles.kpiHint}>{labels.savingsRate}</Text>}
          </View>
        </View>

        <LinesTable
          title={labels.incomesTitle}
          lines={data.incomes}
          total={data.totalIncomes}
          typeLabels={labels.incomeTypes}
          labels={labels}
          color={INCOME_COLOR}
        />
        <LinesTable
          title={labels.expensesTitle}
          lines={data.expenses}
          total={data.totalExpenses}
          typeLabels={labels.expenseTypes}
          labels={labels}
          color={EXPENSE_COLOR}
        />

        {data.expenseShares.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>{labels.distributionTitle}</Text>
            {data.expenseShares.map((share) => (
              <View key={share.type} style={styles.shareRow}>
                <Text style={styles.shareLabel}>{labels.expenseTypes[share.type] ?? share.type}</Text>
                <View style={styles.shareTrack}>
                  <View style={[styles.shareBar, { width: `${Math.max(share.share * 100, 1)}%` }]} />
                </View>
                <Text style={styles.shareValue}>{formatPdfPercent(share.share)}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.disclaimer}>{labels.disclaimer}</Text>
        <Text style={styles.pagination} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  )
}
