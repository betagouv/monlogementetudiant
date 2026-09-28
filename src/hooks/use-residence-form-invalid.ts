import { useTranslations } from 'next-intl'
import { parseAsString, useQueryState } from 'nuqs'
import { type RefObject, useCallback } from 'react'
import type { FieldErrors, FieldValues } from 'react-hook-form'
import { createToast } from '~/components/ui/createToast'

const ERROR_SELECTOR = [
  '.fr-input-group--error',
  '.fr-select-group--error',
  '.fr-fieldset--error',
  '.fr-error-text',
  '[aria-invalid="true"]',
].join(', ')

const FOCUSABLE_SELECTOR = 'input:not([type="hidden"]), select, textarea, button'

const afterRender = (callback: () => void) => requestAnimationFrame(() => requestAnimationFrame(callback))

const focusableIn = (element: HTMLElement) =>
  element.matches(FOCUSABLE_SELECTOR) ? element : element.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)

export const scrollToFirstError = (form: HTMLElement | null) => {
  const errors = Array.from(form?.querySelectorAll<HTMLElement>(ERROR_SELECTOR) ?? [])
  if (errors.length === 0) return
  errors[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
  const focusable = errors.map(focusableIn).find(Boolean)
  focusable?.focus({ preventScroll: true })
}

export const useResidenceFormInvalid = <T extends FieldValues>(formRef: RefObject<HTMLFormElement | null>) => {
  const t = useTranslations('bailleur.residences.details.form')
  const [, setTypologyTab] = useQueryState('typology', parseAsString)

  return useCallback(
    async (errors: FieldErrors<T>) => {
      const typologyErrors = errors.typologies
      if (Array.isArray(typologyErrors)) {
        const firstInvalid = typologyErrors.findIndex(Boolean)
        if (firstInvalid >= 0) await setTypologyTab(`tab-${firstInvalid}`)
      }
      createToast({ priority: 'warning', message: t('invalid') })
      afterRender(() => scrollToFirstError(formRef.current))
    },
    [formRef, setTypologyTab, t],
  )
}
