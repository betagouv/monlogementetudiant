'use client'

import clsx from 'clsx'
import { type FocusEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react'
import styles from './toggletip.module.css'

interface ToggletipProps {
  label: string
  children: ReactNode
}

export const Toggletip = ({ label, children }: ToggletipProps) => {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const rootRef = useRef<HTMLSpanElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const closedByEscape = useRef(false)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      const focusInside = rootRef.current?.contains(document.activeElement)
      if (focusInside && document.activeElement !== buttonRef.current) {
        closedByEscape.current = true
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const onBlur = (event: FocusEvent) => {
    if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false)
  }

  return (
    <span ref={rootRef} className={styles.root} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onBlur={onBlur}>
      <button
        ref={buttonRef}
        type="button"
        className={clsx('fr-icon-question-line fr-icon--sm', styles.trigger)}
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
        onFocus={() => {
          if (closedByEscape.current) closedByEscape.current = false
          else setOpen(true)
        }}
      />
      <div id={panelId} className={clsx('fr-text--sm fr-mb-0', styles.panel)} hidden={!open}>
        {children}
      </div>
    </span>
  )
}
