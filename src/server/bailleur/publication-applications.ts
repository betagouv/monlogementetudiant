export const applicationsPatchOnPublishChange = (before: boolean, next: boolean | undefined): Partial<{ acceptsApplications: false }> =>
  before && next === false ? { acceptsApplications: false } : {}
