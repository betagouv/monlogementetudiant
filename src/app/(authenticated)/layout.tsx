import { Signout } from '~/components/signout'

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Signout />
      {children}
    </>
  )
}
