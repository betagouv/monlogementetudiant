'use client'

import { useQuery } from '@tanstack/react-query'
import type { EReminderType } from '~/enums/reminder-email'
import type { TBlockedReason } from '~/server/services/brevo-reminders'
import { useTRPC } from '~/server/trpc/client'

type ReminderEmailsFilters = {
  page: number
  from: string
  to: string
  type?: EReminderType
  search?: string
}

type BlockedContactsFilters = {
  page: number
  from: string
  to: string
  reason?: TBlockedReason
}

export const useAdminReminderEmails = (filters: ReminderEmailsFilters) => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.reminders.sentEmails.queryOptions(filters))
}

export const useAdminBlockedContacts = (filters: BlockedContactsFilters) => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.reminders.blockedContacts.queryOptions(filters))
}

export const useAdminUnblockHistory = (page: number) => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.reminders.unblockHistory.queryOptions({ page }))
}
