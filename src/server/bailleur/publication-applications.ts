export const applicationsPatchOnPublishChange = (before: boolean, next: boolean | undefined): { acceptsApplications: false } | object =>
  before && next === false ? { acceptsApplications: false } : {}
