'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useSaveBudgetSimulation } from '~/hooks/use-budget-simulation'
import { authClient } from '~/services/better-auth-client'
import { storePendingBudgetSimulation } from '~/utils/pending-budget-simulation'
import type { TOutboundLinkTarget } from '~/utils/widget-campaign'
import { useBudgetSimulator } from './budget-simulator-context'

export function BudgetSummaryActions({ ctaTarget = '_self' }: { ctaTarget?: TOutboundLinkTarget } = {}) {
  const t = useTranslations('budgetSimulator.summary')
  const router = useRouter()
  const { state } = useBudgetSimulator()
  const { data: session, isPending: isSessionPending } = authClient.useSession()
  const { mutateAsync: saveSimulation, isLoading: isSaving } = useSaveBudgetSimulation()

  const navigate = (url: string) => {
    if (ctaTarget === '_top') {
      window.open(url, '_top')
    } else {
      router.push(url)
    }
  }

  const handleSave = async () => {
    if (!session) {
      storePendingBudgetSimulation(state)
      navigate('/se-connecter')
      return
    }

    await saveSimulation(state)
      .then(() => navigate('/mon-espace/mon-budget'))
      .catch(() => undefined)
  }

  return (
    <div className="fr-mt-2w">
      <Button className="fr-width-full fr-justify-content-center" onClick={handleSave} disabled={isSaving || isSessionPending}>
        {t('saveCta')}
      </Button>
    </div>
  )
}
