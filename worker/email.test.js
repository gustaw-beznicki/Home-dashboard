import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendInviteEmail } from './email.js'

const configured = {
  RESEND_API_KEY: 'test-key',
  INVITE_EMAIL_FROM: 'Home Dashboard <no-reply@example.com>',
  BASE_URL: 'https://example.com',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sendInviteEmail', () => {
  it('no-ops without sending when Resend is not configured', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendInviteEmail(
      { BASE_URL: 'https://example.com' },
      { to: 'new@example.com', invitedByEmail: 'admin@example.com' }
    )

    expect(result).toEqual({ sent: false, reason: 'not configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts to Resend and reports sent', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendInviteEmail(configured, {
      to: 'new@example.com',
      invitedByEmail: 'admin@example.com',
    })

    expect(result).toEqual({ sent: true })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.headers.Authorization).toBe('Bearer test-key')

    const body = JSON.parse(init.body)
    expect(body.to).toBe('new@example.com')
    expect(body.text).toContain('admin@example.com')
    expect(body.text).toContain('https://example.com')
  })

  // The caller in worker/index.js swallows this so a mail outage can't fail an
  // invite — the D1 row is the source of truth. Surfacing it here keeps that
  // decision explicit rather than accidental.
  it('throws when Resend rejects, for the caller to swallow', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 422 }))

    await expect(
      sendInviteEmail(configured, { to: 'new@example.com', invitedByEmail: 'admin@example.com' })
    ).rejects.toThrow('Resend responded 422')
  })
})
