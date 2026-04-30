// server/utils/auth.ts
// §4.1 Auth Module — SSO session guard
// STUB: reads a role header injected by dev tooling.
//       Replace with real Covenant SSO JWT validation.

import type { H3Event } from 'h3'
import { getHeader, createError } from 'h3'

export type UserRole = 'Admin' | 'Faculty'

export interface AuthContext {
  userId: string
  role: UserRole
}

/**
 * Attach auth context to the event or throw 401/403.
 * In SSO mode the SAML middleware sets event.context.auth from the session;
 * in dev mode a fallback header shim is used.
 */
export function requireAuth(
  event: H3Event,
  allowedRoles: UserRole[],
): AuthContext {
  // SSO mode: SAML middleware already populated event.context.auth from session.
  if (event.context.auth) {
    const ctx = event.context.auth as AuthContext
    if (!allowedRoles.includes(ctx.role)) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }
    return ctx
  }

  // Dev shim: pass  X-Dev-Role: Admin  or  X-Dev-Role: Faculty  header.
  // Remove before production; replace with JWT decode from cookie.
  const devRole = getHeader(event, 'x-dev-role') as UserRole | undefined
  const devUserId = getHeader(event, 'x-dev-user') ?? 'dev-user-001'

  const ctx: AuthContext = {
    userId: devUserId,
    role: devRole ?? 'Admin',
  }

  if (!allowedRoles.includes(ctx.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  // Attach to event context so route handlers and audit service can read it.
  event.context.auth = ctx
  return ctx
}
