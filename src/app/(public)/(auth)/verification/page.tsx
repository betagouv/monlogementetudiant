import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

interface VerificationPageProps {
  searchParams: Promise<{ sesame?: string; validation_token?: string; error?: string }>
}

export default async function VerificationPage({ searchParams }: VerificationPageProps) {
  const { sesame, validation_token, error } = await searchParams

  if (error) {
    const t = await getTranslations('verification')
    return (
      <div>
        <p>{t('genericError')}</p>
      </div>
    )
  }

  if (!sesame && !validation_token) {
    return notFound()
  }

  if (sesame) {
    redirect(`/api/auth/external-auth/signin/magic-link?sesame=${encodeURIComponent(sesame)}`)
  }
  if (validation_token) {
    redirect(`/api/accounts/students/validate?validation_token=${encodeURIComponent(validation_token)}`)
  }
}
