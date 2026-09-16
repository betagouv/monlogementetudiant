import clsx from 'clsx'
import { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { MagicLinkRedirect } from '~/components/magic-link-redirect/magic-link-redirect'
import background from '~/images/background-owner.webp'
import { env } from '~/server/env'
import authStyles from '../../auth.module.css'

export const revalidate = 0

const MAGIC_LINK_VERIFY_PATH = '/api/auth/magic-link/verify'

/**
 * Vérifie que l'URL cible est bien l'endpoint de vérification Better Auth de notre
 * propre origine : aucune autre destination de redirection n'est acceptée.
 */
function getSafeVerifyUrl(url: string | undefined): string | null {
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const base = new URL(env.BASE_URL)
  if (parsed.origin !== base.origin) return null
  if (!parsed.pathname.startsWith(MAGIC_LINK_VERIFY_PATH)) return null
  return parsed.toString()
}

export async function generateMetadata(): Promise<Metadata> {
  const tMeta = await getTranslations('metadata')
  return {
    title: tMeta('verificationBuffer.title'),
    description: tMeta('verificationBuffer.description'),
  }
}

interface VerificationBufferPageProps {
  searchParams: Promise<{ url?: string }>
}

export default async function VerificationBufferPage({ searchParams }: VerificationBufferPageProps) {
  const t = await getTranslations('verification.buffer')
  const { url } = await searchParams

  const safeUrl = getSafeVerifyUrl(url)
  if (!safeUrl) {
    notFound()
  }

  return (
    <>
      <div className={authStyles.imageContainer}>
        <Image className={authStyles.image} src={background} alt="" priority quality={100} />
      </div>
      <div className={clsx(authStyles.container, 'fr-container')}>
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>
        <p className="fr-text--sm">
          {t('fallbackText')}
          <br />
          <a href={safeUrl}>{t('fallbackLink')}</a>
        </p>
      </div>
      <MagicLinkRedirect url={safeUrl} />
    </>
  )
}
