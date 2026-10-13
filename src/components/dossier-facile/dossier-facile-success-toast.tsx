'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { createToast } from '~/components/ui/createToast'

export const DossierFacileSuccessToast = () => {
  const t = useTranslations('student.personalInformations.dossierFacile')
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const dfSuccess = searchParams.get('df_success')

  useEffect(() => {
    if (dfSuccess !== '1') return

    createToast({
      priority: 'success',
      message: t('linkedToast'),
    })

    const params = new URLSearchParams(searchParams.toString())
    params.delete('df_success')
    const newUrl = params.size > 0 ? `${pathname}?${params.toString()}` : pathname
    router.replace(newUrl, { scroll: false })
  }, [dfSuccess, searchParams, router, pathname, t])

  return null
}
