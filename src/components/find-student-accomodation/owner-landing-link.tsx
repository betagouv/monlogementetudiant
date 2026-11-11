'use client'

import type { FC, ReactNode } from 'react'
import { NewWindowHint } from '~/components/ui/new-window'
import { useTRPCClient } from '~/server/trpc/client'

interface OwnerLandingLinkProps {
  href: string
  accommodationSlug: string
  children: ReactNode
}

export const OwnerLandingLink: FC<OwnerLandingLinkProps> = ({ href, accommodationSlug, children }) => {
  const trpcClient = useTRPCClient()

  const handleClick = () => {
    trpcClient.tracking.logOwnerLandingClick.mutate({ accommodationSlug }).catch(() => undefined)
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={handleClick}>
      {children}
      <NewWindowHint />
    </a>
  )
}
