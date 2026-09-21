import type { getTranslations } from 'next-intl/server'
import { TTerritory } from '~/schemas/territories'
import { getCanonicalUrl } from '~/utils/canonical'
import { type BreadcrumbItem, type FaqItem } from '~/utils/schema'

type TBreadcrumbsTranslator = Awaited<ReturnType<typeof getTranslations<'breadcrumbs'>>>
type TFaqJsonLdTranslator = Awaited<ReturnType<typeof getTranslations<'findAccomodation.faqJsonLd'>>>

export function getSearchBreadcrumbItems(
  t: TBreadcrumbsTranslator,
  territory: TTerritory | undefined,
  routeCategoryKey: string,
): BreadcrumbItem[] {
  return [
    { name: t('homeLabel'), item: getCanonicalUrl('/') },
    { name: t('findAccomodation'), item: getCanonicalUrl('/trouver-un-logement-etudiant') },
    ...(territory && routeCategoryKey
      ? [
          {
            name: territory.name,
            item: getCanonicalUrl(`/trouver-un-logement-etudiant/${routeCategoryKey}/${territory.slug}`),
          },
        ]
      : []),
  ]
}

const FAQ_JSON_LD_KEYS = ['housingTypes', 'typologies', 'chargesIncluded'] as const

export function getSearchFaqItems(t: TFaqJsonLdTranslator): FaqItem[] {
  return FAQ_JSON_LD_KEYS.map((key) => ({ question: t(`${key}.question`), answer: t(`${key}.answer`) }))
}
