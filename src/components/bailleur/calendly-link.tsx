'use client'

import Link from 'next/link'
import { trackEvent } from '~/lib/tracking'

export const CalendlyLink = ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => {
  return (
    <Link
      className={className}
      target="_blank"
      href={href}
      onClick={() => {
        trackEvent({ category: 'Espace Gestionnaire', action: 'reservation calendly' })
      }}
    >
      {children}
    </Link>
  )
}
