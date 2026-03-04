import { TUser } from '~/lib/types'

export const StudentWelcome = ({ user }: { user: TUser }) => (
  <div className="fr-border-right fr-border-top fr-border-bottom fr-px-6w fr-py-5w">
    <h1>Ravi de vous revoir {user.firstname} 👋</h1>
    <span className="fr-text--xl fr-text-mention--grey">Bienvenue dans votre espace personnel</span>
  </div>
)
