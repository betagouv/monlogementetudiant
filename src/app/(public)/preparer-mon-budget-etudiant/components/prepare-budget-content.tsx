import { fr } from '@codegouvfr/react-dsfr'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import PrepareBudgetAidsTable from '~/app/(public)/preparer-mon-budget-etudiant/components/prepare-budget-aids-table'
import PrepareBudgetContentCard from '~/app/(public)/preparer-mon-budget-etudiant/components/prepare-budget-content-card'
import PrepareBudgetContentHeader from '~/app/(public)/preparer-mon-budget-etudiant/components/prepare-budget-content-header'
import PrepareBudgetRedirectionCard from '~/app/(public)/preparer-mon-budget-etudiant/components/prepare-budget-redirection-card'
import PrepareBudgetSimulateAidsCard from '~/app/(public)/preparer-mon-budget-etudiant/components/prepare-budget-simulate-aids-card'
import imageHero from '~/images/prepare-budget-content.webp'
import styles from '../preparer-mon-budget-etudiant.module.css'

export default async function PrepareBudgetContent() {
  const t = await getTranslations('prepareBudget.content')
  const cards = [
    {
      translationKey: 'prepareBudget.content.item1',
      itemsKeys: ['list.item1', 'list.item2', 'list.item3', 'list.item4', 'list.item5', 'list.item6', 'list.item7', 'list.item8'],
      children: <PrepareBudgetSimulateAidsCard />,
      id: 'definir-vos-ressources-mensuelles',
    },
    {
      translationKey: 'prepareBudget.content.item2',
      itemsKeys: ['list.item1', 'list.item2', 'list.item3', 'list.item4', 'list.item5', 'list.item6'],
      id: 'identifier-vos-charges-fixes',
    },
    {
      translationKey: 'prepareBudget.content.item3',
      itemsKeys: ['list.item1', 'list.item2', 'list.item3', 'list.item4', 'list.item5'],
      id: 'estimer-vos-depenses-variables',
    },
    {
      translationKey: 'prepareBudget.content.item4',
      itemsKeys: ['list.item1', 'list.item2', 'list.item3', 'list.item4', 'list.item5'],
      id: 'anticiper-les-depenses-exceptionnelles',
    },
    {
      translationKey: 'prepareBudget.content.item5',
      itemsKeys: [],
      children: <PrepareBudgetAidsTable />,
      id: 'aides-a-ne-pas-oublier',
    },
  ]
  return (
    <div className={fr.cx('fr-col-md-8', 'fr-px-4w', 'fr-py-5w')}>
      <h2 className="fr-h6" style={{ color: fr.colors.decisions.text.mention.grey.default, fontWeight: '400 !important' }}>
        {t('subtitle')}
      </h2>
      <h2 className="fr-h1">
        {t('mainTitlePart1')}
        <br />
        <span>{t('mainTitlePart2')}</span>
      </h2>
      <Image src={imageHero} alt="" aria-hidden="true" priority quality={100} className={styles.imageHero} />
      <PrepareBudgetContentHeader />
      {cards.map((card, index) => (
        <PrepareBudgetContentCard key={card.translationKey} {...card} withBorder={index !== cards.length - 1}>
          {card.children}
        </PrepareBudgetContentCard>
      ))}
      <PrepareBudgetRedirectionCard />
    </div>
  )
}
