import { redirectToWp } from '~/utils/wp-redirect'

const handler = (request: Request) => redirectToWp(request, '/mentions-legales/')

export { handler as GET }
