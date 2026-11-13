'use client'

import { Pagination } from '~/components/ui/pagination'

type AdminClientPaginationProps = {
  count: number
  page: number
  onPageChange: (page: number) => void
}

export const AdminClientPagination = ({ count, page, onPageChange }: AdminClientPaginationProps) => {
  if (count <= 1) return null
  return (
    <Pagination
      className="fr-flex fr-justify-content-center fr-mt-3w"
      count={count}
      defaultPage={page}
      getPageLinkProps={(target) => ({
        href: '#',
        onClick: (e) => {
          e.preventDefault()
          onPageChange(target)
        },
      })}
    />
  )
}
