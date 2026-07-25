// The one piece of this app that talks to a third party, and deliberately the
// most disposable: Better Auth sends no email, and with Google as the only
// sign-in method there is no password to reset, so the only thing worth mailing
// is "you've been invited, go sign in". Deleting this file and its call site
// would cost a courtesy notification and nothing else.
//
// Resend's REST API directly rather than their SDK — one fetch, no dependency.
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export async function sendInviteEmail(env, { to, invitedByEmail }) {
  if (!env.RESEND_API_KEY || !env.INVITE_EMAIL_FROM) return { sent: false, reason: 'not configured' }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.INVITE_EMAIL_FROM,
      to,
      subject: 'Zaproszenie do Home Dashboard',
      text: [
        `${invitedByEmail} zaprosił Cię do Home Dashboard.`,
        '',
        `Zaloguj się przez Google: ${env.BASE_URL}`,
        '',
        'Użyj tego adresu e-mail — zaproszenie jest do niego przypisane.',
      ].join('\n'),
    }),
  })

  if (!response.ok) {
    throw new Error(`Resend responded ${response.status}`)
  }
  return { sent: true }
}
