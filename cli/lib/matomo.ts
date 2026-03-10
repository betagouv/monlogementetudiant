const MATOMO_URL = process.env.MATOMO_URL!
const MATOMO_TOKEN = process.env.MATOMO_TOKEN!
const MATOMO_ID_SITE = process.env.MATOMO_ID_SITE!

interface MatomoParams {
  method: string
  date?: string
  period?: string
  [key: string]: string | undefined
}

async function matomoRequest(params: MatomoParams): Promise<unknown> {
  const url = new URL(MATOMO_URL)
  url.searchParams.set('module', 'API')
  url.searchParams.set('format', 'JSON')
  url.searchParams.set('idSite', MATOMO_ID_SITE)
  url.searchParams.set('token_auth', MATOMO_TOKEN)
  for (const [key, value] of Object.entries(params)) {
    if (value != null) url.searchParams.set(key, value)
  }

  const response = await fetch(url.toString())
  if (!response.ok) throw new Error(`Matomo API error: ${response.status}`)
  return response.json()
}

export interface CompleteStats {
  uniqueVisitors: number
  newVisitsPercentage: number
  averageDuration: number
  bounceRatePercentage: number
  pageViews: number
  visitorsPerPage: number
  topPages: { label: string; nbVisits: number }[]
  mainEntryPages: { label: string; nbVisits: number }[]
  mainSources: { label: string; nbVisits: number }[]
}

export async function getCompleteStats(date: string): Promise<CompleteStats> {
  const [visitSummary, actions, entryPages, referrers] = await Promise.all([
    matomoRequest({ method: 'VisitsSummary.get', date, period: 'day' }) as Promise<Record<string, number>>,
    matomoRequest({ method: 'Actions.getPageUrls', date, period: 'day', flat: '1', filter_limit: '10' }) as Promise<
      { label: string; nb_visits: number }[]
    >,
    matomoRequest({ method: 'Actions.getEntryPageUrls', date, period: 'day', flat: '1', filter_limit: '10' }) as Promise<
      { label: string; nb_visits: number }[]
    >,
    matomoRequest({ method: 'Referrers.getWebsites', date, period: 'day', filter_limit: '10' }) as Promise<
      { label: string; nb_visits: number }[]
    >,
  ])

  return {
    uniqueVisitors: visitSummary.nb_uniq_visitors ?? 0,
    newVisitsPercentage: visitSummary.nb_visits_new ? (visitSummary.nb_visits_new / (visitSummary.nb_visits || 1)) * 100 : 0,
    averageDuration: visitSummary.avg_time_on_site ?? 0,
    bounceRatePercentage: visitSummary.bounce_rate ? Number.parseFloat(String(visitSummary.bounce_rate)) : 0,
    pageViews: visitSummary.nb_actions ?? 0,
    visitorsPerPage: visitSummary.nb_actions && visitSummary.nb_visits ? visitSummary.nb_actions / visitSummary.nb_visits : 0,
    topPages: (actions ?? []).map((p) => ({ label: p.label, nbVisits: p.nb_visits })),
    mainEntryPages: (entryPages ?? []).map((p) => ({ label: p.label, nbVisits: p.nb_visits })),
    mainSources: (referrers ?? []).map((r) => ({ label: r.label, nbVisits: r.nb_visits })),
  }
}

export interface EventData {
  category: string
  action: string
  nbEvents: number
  nbUniqueEvents: number
  eventValue: number
}

export async function getAllEvents(date: string): Promise<EventData[]> {
  const categories = (await matomoRequest({
    method: 'Events.getCategory',
    date,
    period: 'day',
    flat: '1',
    filter_limit: '-1',
  })) as {
    label: string
    nb_events: number
    nb_events_with_value: number
    sum_event_value: number
    subtable?: { label: string; nb_events: number; nb_events_with_value: number; sum_event_value: number }[]
  }[]

  const events: EventData[] = []

  for (const cat of categories ?? []) {
    const actions = (await matomoRequest({
      method: 'Events.getActionFromCategoryId',
      date,
      period: 'day',
      idSubtable: String(cat.subtable ? 1 : 0),
      label: cat.label,
      filter_limit: '-1',
    })) as { label: string; nb_events: number; nb_events_with_value: number; sum_event_value: number }[]

    if (Array.isArray(actions)) {
      for (const action of actions) {
        events.push({
          category: cat.label,
          action: action.label,
          nbEvents: action.nb_events ?? 0,
          nbUniqueEvents: action.nb_events_with_value ?? 0,
          eventValue: action.sum_event_value ?? 0,
        })
      }
    } else {
      events.push({
        category: cat.label,
        action: '',
        nbEvents: cat.nb_events ?? 0,
        nbUniqueEvents: cat.nb_events_with_value ?? 0,
        eventValue: cat.sum_event_value ?? 0,
      })
    }
  }

  return events
}
