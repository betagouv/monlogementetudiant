'use client'

import clsx from 'clsx'

interface BudgetSectionProps {
  icon: string
  iconColor?: string
  title: string
  subtitle: string
  iconSize?: string
  children: React.ReactNode
}

export function BudgetSection({ icon, iconColor, title, subtitle, iconSize, children }: BudgetSectionProps) {
  return (
    <div className="fr-flex fr-direction-column fr-pt-2w fr-pb-3w fr-px-3w fr-pt-md-4w fr-pb-md-6w fr-px-md-7w">
      <div className="fr-flex fr-align-items-center fr-flex-gap-4v">
        <span className={clsx(iconSize, icon, 'fr-mb-0', iconColor)} />
        <div className="fr-flex fr-direction-column fr-justify-content-center">
          <span className="fr-h3 fr-mb-0">{title}</span>
          <span className="fr-text-mention--grey">{subtitle}</span>
        </div>
      </div>
      <hr className="fr-width-full fr-mt-4w fr-mb-2w" />
      {children}
    </div>
  )
}
