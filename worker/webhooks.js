import { verifyWebhook } from '@clerk/backend/webhooks'
import { jsonResponse } from './auth.js'
import { confirmInvitedUser } from './db.js'

// Clerk calls this directly (svix-signed, not a user session) once someone
// accepts an admin's invitation and finishes signing up. That's the only
// point a Clerk user ID exists for them, so this is what flips their D1 row
// from 'pending' to 'active' and records it.
export async function handleClerkWebhook(request, env) {
  let event
  try {
    event = await verifyWebhook(request, { signingSecret: env.CLERK_WEBHOOK_SIGNING_SECRET })
  } catch {
    return jsonResponse({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  if (event.type === 'user.created') {
    const { id, email_addresses, primary_email_address_id } = event.data
    const email = email_addresses.find((e) => e.id === primary_email_address_id)?.email_address
    if (email) {
      await confirmInvitedUser(env, email, id)
    }
  }

  return jsonResponse({ received: true })
}
