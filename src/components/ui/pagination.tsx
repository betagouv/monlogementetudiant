'use client'

import { type RegisteredLinkProps } from '@codegouvfr/react-dsfr/link'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { type CSSProperties, memo } from 'react'
import styles from './pagination.module.css'

export type PaginationProps = {
  id?: string
  className?: string
  count: number
  defaultPage?: number
  classes?: Partial<Record<'root' | 'list' | 'link', string>>
  style?: CSSProperties
  showFirstLast?: boolean
  getPageLinkProps: (pageNumber: number) => RegisteredLinkProps
}

// Reproduit le decoupage de @codegouvfr/react-dsfr/Pagination (au plus une ellipse).
const getPaginationParts = ({ count, defaultPage }: { count: number; defaultPage: number }) => {
  const maxVisiblePages = 10
  const slicesSize = 4
  if (count <= maxVisiblePages) {
    return Array.from({ length: count }, (_, v) => ({ number: v + 1, active: defaultPage === v + 1 }))
  }
  if (defaultPage > count - maxVisiblePages) {
    return Array.from({ length: maxVisiblePages }, (_, v) => {
      const pageNumber = count - (maxVisiblePages - v) + 1
      return { number: pageNumber, active: defaultPage === pageNumber }
    })
  }
  return [
    ...Array.from({ length: slicesSize }, (_, v) => {
      if (defaultPage > slicesSize) {
        const pageNumber = v + defaultPage
        return { number: pageNumber, active: defaultPage === pageNumber }
      }
      return { number: v + 1, active: defaultPage === v + 1 }
    }),
    { number: null as number | null, active: false },
    ...Array.from({ length: slicesSize }, (_, v) => {
      const pageNumber = count - (slicesSize - v) + 1
      return { number: pageNumber, active: defaultPage === pageNumber }
    }),
  ]
}

/**
 * Pagination identique au composant DSFR, mais dont l'ellipse « … » est un
 * <select> permettant de sauter directement sur l'une des pages masquees.
 */
export const Pagination = memo(function Pagination(props: PaginationProps) {
  const { id, className, count, defaultPage = 1, showFirstLast = true, getPageLinkProps, classes = {}, style } = props

  const t = useTranslations('pagination')
  const router = useRouter()

  const parts = getPaginationParts({ count, defaultPage })
  const isFirstPage = defaultPage <= 1
  const isLastPage = defaultPage >= count

  const goToPage = (pageNumber: number) => {
    const linkProps = getPageLinkProps(pageNumber)
    let prevented = false
    linkProps.onClick?.({
      preventDefault: () => {
        prevented = true
      },
    } as React.MouseEvent<HTMLAnchorElement>)
    if (!prevented && typeof linkProps.href === 'string' && linkProps.href && linkProps.href !== '#') {
      router.push(linkProps.href)
    }
  }

  return (
    <nav
      id={id}
      role="navigation"
      className={'fr-pagination' + (classes.root ? ` ${classes.root}` : '') + (className ? ` ${className}` : '')}
      aria-label={t('label')}
      style={style}
    >
      <ul className={'fr-pagination__list' + (classes.list ? ` ${classes.list}` : '')}>
        {showFirstLast && (
          <li>
            {isFirstPage ? (
              <a className="fr-pagination__link fr-pagination__link--first" aria-disabled role="link">
                {t('first')}
              </a>
            ) : (
              <Link className="fr-pagination__link fr-pagination__link--first" {...getPageLinkProps(1)}>
                {t('first')}
              </Link>
            )}
          </li>
        )}
        <li>
          {isFirstPage ? (
            <a className="fr-pagination__link fr-pagination__link--prev fr-pagination__link--lg-label" aria-disabled role="link">
              {t('previous')}
            </a>
          ) : (
            <Link
              className="fr-pagination__link fr-pagination__link--prev fr-pagination__link--lg-label"
              {...getPageLinkProps(defaultPage - 1)}
            >
              {t('previous')}
            </Link>
          )}
        </li>
        {parts.map((part, index) => (
          <li key={part.number ?? `ellipsis-${index}`}>
            {part.number === null ? (
              <EllipsisSelect
                from={(parts[index - 1]?.number ?? 0) + 1}
                to={(parts[index + 1]?.number ?? count + 1) - 1}
                onSelect={goToPage}
              />
            ) : (
              <Link
                className={'fr-pagination__link' + (classes.link ? ` ${classes.link}` : '')}
                aria-current={part.active ? true : undefined}
                title={t('page', { number: part.number })}
                {...getPageLinkProps(part.number)}
              >
                {part.number}
              </Link>
            )}
          </li>
        ))}
        <li>
          {isLastPage ? (
            <a className="fr-pagination__link fr-pagination__link--next fr-pagination__link--lg-label" aria-disabled role="link">
              {t('next')}
            </a>
          ) : (
            <Link
              className="fr-pagination__link fr-pagination__link--next fr-pagination__link--lg-label"
              {...getPageLinkProps(defaultPage + 1)}
            >
              {t('next')}
            </Link>
          )}
        </li>
        {showFirstLast && (
          <li>
            {isLastPage ? (
              <a className="fr-pagination__link fr-pagination__link--last" aria-disabled>
                {t('last')}
              </a>
            ) : (
              <Link className="fr-pagination__link fr-pagination__link--last" {...getPageLinkProps(count)}>
                {t('last')}
              </Link>
            )}
          </li>
        )}
      </ul>
    </nav>
  )
})

function EllipsisSelect({ from, to, onSelect }: { from: number; to: number; onSelect: (page: number) => void }) {
  const t = useTranslations('pagination')
  const pages: number[] = []
  for (let page = from; page <= to; page++) {
    pages.push(page)
  }

  return (
    <span className={styles.ellipsis}>
      <span className="fr-pagination__link" aria-hidden="true">
        …
      </span>
      <select
        className={styles.select}
        aria-label={t('jumpTo', { from, to })}
        value=""
        onChange={(event) => {
          const value = Number(event.target.value)
          if (value) {
            onSelect(value)
          }
        }}
      >
        <option value="" disabled>
          …
        </option>
        {pages.map((page) => (
          <option key={page} value={page}>
            {page}
          </option>
        ))}
      </select>
    </span>
  )
}

export default Pagination
