import path from 'node:path'
import { Document, Font, Page, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer'
import type { TBudgetFrequency } from '~/schemas/budget-simulation'
import { formatPdfAmount, formatPdfPercent, type TBudgetPdfData, type TBudgetPdfLine } from '~/server/budget-pdf/budget-pdf-data'
import { donutSlices } from '~/server/budget-pdf/donut'
import { EXPENSE_COLORS } from '~/utils/budget-colors'

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

const DONUT_SIZE = 96
const DONUT_OUTER = 48
const DONUT_INNER = 36

const BLUE_FRANCE = '#000091'
const RED_MARIANNE = '#e1000f'
const GREY_TEXT = '#666666'
const BORDER = '#dddddd'
const INCOME_COLOR = '#18753c'
const EXPENSE_COLOR = '#ce0500'

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 72, fontFamily: FONT_FAMILY, fontSize: 10, color: '#161616' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
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
  subtitle: { fontSize: 9, color: GREY_TEXT, marginBottom: 16 },
  kpis: { flexDirection: 'row', marginBottom: 16, borderWidth: 1, borderColor: BORDER },
  kpi: { flex: 1, padding: 10, alignItems: 'center' },
  kpiSeparator: { borderLeftWidth: 1, borderLeftColor: BORDER },
  kpiLabel: { fontSize: 8, color: GREY_TEXT, marginBottom: 4, textAlign: 'center' },
  kpiValue: { fontSize: 14, fontWeight: 'bold' },
  kpiHint: { fontSize: 7, color: GREY_TEXT, marginTop: 2, textAlign: 'center' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: BORDER },
  tableHeader: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: BORDER },
  tableHeaderCell: { fontSize: 8, color: GREY_TEXT, fontWeight: 'bold' },
  row: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#eeeeee' },
  totalRow: { flexDirection: 'row', paddingVertical: 5 },
  colLabel: { flex: 4, paddingRight: 8 },
  colFrequency: { flex: 1 },
  colAmount: { flex: 1.2, textAlign: 'right' },
  colMonthly: { flex: 1.4, textAlign: 'right' },
  bold: { fontWeight: 'bold' },
  empty: { color: GREY_TEXT, fontStyle: 'italic', paddingVertical: 4 },
  chartRow: { flexDirection: 'row', alignItems: 'center' },
  chart: { width: DONUT_SIZE, height: DONUT_SIZE, marginRight: 24 },
  legend: { flex: 1 },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendLabel: { flex: 1, fontSize: 9, paddingRight: 8 },
  legendValue: { fontSize: 9, textAlign: 'right' },
  legendPercent: { color: GREY_TEXT },
  disclaimer: { position: 'absolute', bottom: 36, left: 40, right: 40, fontSize: 7, color: GREY_TEXT },
  pagination: { position: 'absolute', bottom: 22, left: 40, right: 40, fontSize: 7, color: GREY_TEXT, textAlign: 'right' },
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

function LineRow<T extends string>({
  line,
  typeLabels,
  labels,
}: {
  line: TBudgetPdfLine<T>
  typeLabels: Record<string, string>
  labels: TBudgetPdfLabels
}) {
  return (
    <View style={styles.row} wrap={false}>
      <Text style={styles.colLabel}>{typeLabels[line.type] ?? line.type}</Text>
      <Text style={styles.colFrequency}>{labels.frequencies[line.frequency]}</Text>
      <Text style={styles.colAmount}>{formatPdfAmount(line.amount)}</Text>
      <Text style={styles.colMonthly}>{formatPdfAmount(line.monthly)}</Text>
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
  const sectionTitle = <Text style={styles.sectionTitle}>{title}</Text>
  if (lines.length === 0) {
    return (
      <View style={styles.section} wrap={false}>
        {sectionTitle}
        <Text style={styles.empty}>{labels.empty}</Text>
      </View>
    )
  }

  const header = (
    <View style={styles.tableHeader}>
      <Text style={[styles.tableHeaderCell, styles.colLabel]}>{labels.columnCategory}</Text>
      <Text style={[styles.tableHeaderCell, styles.colFrequency]}>{labels.columnFrequency}</Text>
      <Text style={[styles.tableHeaderCell, styles.colAmount]}>{labels.columnAmount}</Text>
      <Text style={[styles.tableHeaderCell, styles.colMonthly]}>{labels.columnMonthly}</Text>
    </View>
  )
  const totalRow = (
    <View style={styles.totalRow}>
      <Text style={[styles.colLabel, styles.bold]}>{labels.total}</Text>
      <Text style={styles.colFrequency} />
      <Text style={styles.colAmount} />
      <Text style={[styles.colMonthly, styles.bold, { color }]}>{formatPdfAmount(total)}</Text>
    </View>
  )
  const row = (line: TBudgetPdfLine<T>) => <LineRow key={line.type} line={line} typeLabels={typeLabels} labels={labels} />

  if (lines.length === 1) {
    return (
      <View style={styles.section} wrap={false}>
        {sectionTitle}
        {header}
        {lines.map(row)}
        {totalRow}
      </View>
    )
  }

  return (
    <View style={styles.section}>
      <View wrap={false}>
        {sectionTitle}
        {header}
        {lines.slice(0, 1).map(row)}
      </View>
      {lines.slice(1, -1).map(row)}
      <View wrap={false}>
        {lines.slice(-1).map(row)}
        {totalRow}
      </View>
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

        {data.expenseShares.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>{labels.distributionTitle}</Text>
            <View style={styles.chartRow}>
              <Svg style={styles.chart} viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}>
                {donutSlices(
                  data.expenseShares.map((share) => ({ key: share.type, share: share.share })),
                  { cx: DONUT_SIZE / 2, cy: DONUT_SIZE / 2, outer: DONUT_OUTER, inner: DONUT_INNER },
                ).map((slice) => (
                  <Path key={slice.key} d={slice.path} fill={EXPENSE_COLORS[slice.key]} />
                ))}
              </Svg>
              <View style={styles.legend}>
                {data.expenseShares.map((share) => (
                  <View key={share.type} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: EXPENSE_COLORS[share.type] }]} />
                    <Text style={styles.legendLabel}>{labels.expenseTypes[share.type] ?? share.type}</Text>
                    <Text style={styles.legendValue}>
                      {formatPdfAmount(share.monthly)} <Text style={styles.legendPercent}>({formatPdfPercent(share.share)})</Text>
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

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
        <Text style={styles.disclaimer} fixed>
          {labels.disclaimer}
        </Text>
        <Text style={styles.pagination} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  )
}
