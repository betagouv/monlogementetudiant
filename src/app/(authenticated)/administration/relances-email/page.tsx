'use client'

import { Tabs } from '@codegouvfr/react-dsfr/Tabs'
import clsx from 'clsx'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { useMemo } from 'react'
import { useDebounce } from 'use-debounce'
import { BlockedContactsTab } from '~/components/administration/relances-email/blocked-contacts-tab'
import { BLOCKED_REASON_CODES } from '~/components/administration/relances-email/labels'
import { SentEmailsTab } from '~/components/administration/relances-email/sent-emails-tab'
import { EReminderType } from '~/enums/reminder-email'
import { getDateFrom } from '~/utils/date-helpers'
import styles from '../administration.module.css'
import statStyles from '../statistiques/statistiques.module.css'

const PRESETS = ['7', '15', '30', '90'] as const
const TAB_SENT = 'envoyes'
const TAB_BLOCKED = 'bloquees'
const TABS = [TAB_SENT, TAB_BLOCKED] as const

export default function RelancesEmailPage() {
  const [qs, setQs] = useQueryStates({
    onglet: parseAsStringLiteral(TABS).withDefault(TAB_SENT),
    page: parseAsInteger.withDefault(1),
    search: parseAsString.withDefault(''),
    preset: parseAsStringLiteral(PRESETS).withDefault('30'),
    from: parseAsString.withDefault(''),
    to: parseAsString.withDefault(''),
    type: parseAsStringLiteral(Object.values(EReminderType)),
    motif: parseAsStringLiteral(BLOCKED_REASON_CODES),
  })
  const [debouncedSearch] = useDebounce(qs.search, 300)

  const range = useMemo(() => {
    if (qs.from && qs.to) return { from: qs.from, to: qs.to }
    return { from: getDateFrom(Number(qs.preset)), to: getDateFrom(0) }
  }, [qs.preset, qs.from, qs.to])

  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <div className={styles.pageIcon}>
            <span className={clsx(styles.pageIconBadge, 'fr-icon-mail-send-line')} aria-hidden="true" />
          </div>
          <h1 className="fr-h3 fr-mb-0">Relances e-mail</h1>
        </div>
        <p className="fr-text--sm fr-text-mention--grey fr-mt-1v">
          Suivi des relances envoyées aux gestionnaires, de leur efficacité et des adresses bloquées
        </p>
      </div>

      <div className={clsx(styles.card, 'fr-mb-3w')}>
        <div className="fr-p-2w">
          <div className={statStyles.dateRangeBar}>
            {qs.onglet === TAB_SENT && (
              <input
                type="text"
                placeholder="Gestionnaire, bailleur ou e-mail..."
                value={qs.search}
                onChange={(e) => setQs({ search: e.target.value, page: 1 })}
                className={statStyles.dateInput}
                style={{ width: '260px' }}
                aria-label="Rechercher par gestionnaire, bailleur ou e-mail"
              />
            )}
            <div className={statStyles.dateRangePresets}>
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={qs.preset === preset && !qs.from ? statStyles.dateRangePresetActive : statStyles.dateRangePreset}
                  onClick={() => setQs({ preset, from: '', to: '', page: 1 })}
                >
                  {preset} jours
                </button>
              ))}
            </div>
            <div className={statStyles.dateInputs}>
              <input
                type="date"
                className={statStyles.dateInput}
                value={qs.from || range.from}
                onChange={(e) => setQs({ from: e.target.value, to: qs.to || range.to, page: 1 })}
                aria-label="Date de début"
              />
              <span className="fr-text--sm fr-mb-0">—</span>
              <input
                type="date"
                className={statStyles.dateInput}
                value={qs.to || range.to}
                onChange={(e) => setQs({ from: qs.from || range.from, to: e.target.value, page: 1 })}
                aria-label="Date de fin"
              />
            </div>
          </div>
        </div>
      </div>

      <Tabs
        selectedTabId={qs.onglet}
        onTabChange={(tabId) => setQs({ onglet: tabId === TAB_BLOCKED ? TAB_BLOCKED : TAB_SENT, page: 1 })}
        tabs={[
          { tabId: TAB_SENT, label: 'Mails envoyés', iconId: 'fr-icon-mail-send-line' },
          { tabId: TAB_BLOCKED, label: 'Adresses bloquées', iconId: 'fr-icon-lock-line' },
        ]}
      >
        {qs.onglet === TAB_BLOCKED ? (
          <BlockedContactsTab
            from={range.from}
            to={range.to}
            page={qs.page}
            reason={qs.motif}
            onReasonChange={(motif) => setQs({ motif, page: 1 })}
            onPageChange={(page) => setQs({ page })}
          />
        ) : (
          <SentEmailsTab
            from={range.from}
            to={range.to}
            page={qs.page}
            type={qs.type}
            search={debouncedSearch}
            onTypeChange={(type) => setQs({ type, page: 1 })}
            onPageChange={(page) => setQs({ page })}
          />
        )}
      </Tabs>
    </>
  )
}
