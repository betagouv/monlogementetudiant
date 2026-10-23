import { redirectToWp } from '~/utils/wp-redirect'

const handler = (request: Request) => redirectToWp(request, '/foire-aux-questions/')

export { handler as GET }
