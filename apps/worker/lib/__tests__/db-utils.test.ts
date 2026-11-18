import { describe, expect, it } from 'vitest'
import { toDockerReachableUrl } from '../db-utils'

describe('toDockerReachableUrl', () => {
  it('remplace localhost par host.docker.internal', () => {
    expect(toDockerReachableUrl('postgres://mle:mle@localhost:5490/mle_dev')).toBe('postgres://mle:mle@host.docker.internal:5490/mle_dev')
  })

  it('remplace 127.0.0.1 par host.docker.internal', () => {
    expect(toDockerReachableUrl('postgres://mle:mle@127.0.0.1:5490/mle_dev?sslmode=disable')).toBe(
      'postgres://mle:mle@host.docker.internal:5490/mle_dev?sslmode=disable',
    )
  })

  it('laisse les hôtes distants inchangés', () => {
    expect(toDockerReachableUrl('postgres://u:p@db.example.com:5432/app')).toBe('postgres://u:p@db.example.com:5432/app')
  })
})
