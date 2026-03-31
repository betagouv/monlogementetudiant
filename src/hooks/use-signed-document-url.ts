import { useMutation } from '@tanstack/react-query'
import { useCallback } from 'react'
import { createToast } from '~/components/ui/createToast'
import { useTRPC } from '~/server/trpc/client'

type UrlType = 'tenantPdf' | 'tenantUrl' | 'document'

export function useSignedDocumentUrl() {
  const trpc = useTRPC()
  const { mutateAsync, isPending } = useMutation(trpc.bailleur.getDocumentSignedUrl.mutationOptions())

  const openDocument = useCallback(
    async (type: UrlType, id: string) => {
      try {
        const { redirectUrl } = await mutateAsync({
          type,
          ...(type === 'document' ? { documentId: id } : { tenantId: id }),
        })
        window.open(redirectUrl, '_blank', 'noopener,noreferrer')
      } catch {
        createToast({ priority: 'error', message: 'Impossible d\u2019ouvrir le document. Veuillez réessayer.' })
      }
    },
    [mutateAsync],
  )

  return { openDocument, isLoading: isPending }
}
