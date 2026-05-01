import {
  H3Event,
  sendRedirect,
  defineEventHandler,
  createError,
  getRequestURL,
  readBody,
  getQuery,
  setResponseHeaders,
} from 'h3'
import fs from 'fs'
import mongoose from 'mongoose'
// @ts-expect-error - saml2-js does not currently publish TypeScript definitions.
import saml2 from 'saml2-js'

import { Users } from '../models/user.model'
import type { AuthContext, UserRole } from '../utils/auth'
import { logAuthEvent } from '../services/auditService'
import { getClientIp } from '../utils/ip'
type SAMLProviders = {
  sp: InstanceType<typeof saml2.ServiceProvider>
  idp: InstanceType<typeof saml2.IdentityProvider>
}

const UsersCollection = Users as any

let providers: SAMLProviders | null = null

const REGISTRAR_ONLY = ['/api/audit-logs']

const FACULTY_READ_ONLY = [
  '/api/professors',
  '/api/rooms',
  '/api/courses',
  '/api/schedule',
]

const FACULTY_OR_REGISTRAR = ['/api/preferences']

// Temporary hardcoded list of registrar covenantIds until we have a proper Registrar collection in the database.
const REGISTRAR_USERNAMES = [
  'maximus.mueller',
  'jacob.eldridge',
  'grant.widener',
  'graham.widener',
  'gabe.righter',
  'jon.moon',
  'ben.mitchell',
  'rodney.miller',
  'david.darden',
  'barbara.wingard',
  'matthew.luther',
]

// Maps Microsoft/Azure AD namespaced SAML attribute keys to friendly names.
const FIELD_MAP: Record<string, string> = {
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'email',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname':
    'firstName',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname': 'lastName',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'displayName',
}

// The Oracle username is the first letter of the first name and then the last name, in all caps.
function lookupOracleUser(email: string) {
  return (
    email.substring(0, 1) +
    email.substring(email.indexOf('.') + 1, email.indexOf('@'))
  ).toUpperCase()
}

function covenantIdFromEmail(email?: string): string | null {
  if (!email || !email.includes('@')) return null
  return email.substring(0, email.indexOf('@')).toLowerCase()
}

async function getRoles(username: string, email?: string): Promise<string[]> {
  const db = mongoose.connection.db
  if (!db) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Database connection not established',
    })
  }

  // When the SAML assertion carries only oracleUser (no email), try to recover
  // the email from a previous Users session entry so role lookup can proceed.
  let resolvedEmail = email
  if (!resolvedEmail) {
    const existingUser = await db.collection('users').findOne({ username })
    if (existingUser?.email) {
      resolvedEmail = existingUser.email
    }
  }

  if (!resolvedEmail) return []

  const roles: string[] = []
  const covenantId = covenantIdFromEmail(resolvedEmail)
  if (!covenantId) return roles

  if (REGISTRAR_USERNAMES.includes(covenantId)) {
    roles.push('Admin')
  }

  const professor = await db.collection('professors').findOne({ covenantId })
  if (professor) {
    roles.push('Faculty')
  }

  return roles
}

function readFileOrThrow(path: string, label: string) {
  if (!fs.existsSync(path)) {
    console.error(`${label} file not found`, { path })
    throw createError({
      statusCode: 500,
      statusMessage: `${label} not configured`,
    })
  }
  return fs.readFileSync(path, 'utf8')
}

function getProviders() {
  if (providers) {
    return providers
  }

  const assertEndpoint = process.env.SAML_ASSERT_ENDPOINT
  const loginUrl = process.env.SAML_LOGIN_URL
  const logoutUrl = process.env.SAML_LOGOUT_URL

  if (!assertEndpoint || !loginUrl || !logoutUrl) {
    throw createError({
      statusCode: 500,
      statusMessage:
        'Missing SAML configuration. Ensure SAML_ASSERT_ENDPOINT, SAML_LOGIN_URL, and SAML_LOGOUT_URL are set.',
    })
  }

  const privateKeyPath =
    process.env.SAML_PRIVATE_KEY_PATH || 'wildcard_covenant_edu.key'
  const certificatePath =
    process.env.SAML_PUBLIC_CERT_PATH || 'wildcard_covenant_edu.pem'
  const idpCertificatePath = process.env.SAML_CERT || 'microsoft_saml.cer'

  const spOptions = {
    entity_id: process.env.SAML_ENTITY_ID || 'cbi3.covenant.edu',
    private_key: readFileOrThrow(privateKeyPath, 'SAML private key'),
    certificate: readFileOrThrow(certificatePath, 'SAML public certificate'),
    assert_endpoint: assertEndpoint,
  }

  const idpOptions = {
    sso_login_url: loginUrl,
    sso_logout_url: logoutUrl,
    certificates: [readFileOrThrow(idpCertificatePath, 'IdP certificate')],
    allow_unencrypted_assertion: true,
  }

  providers = {
    sp: new saml2.ServiceProvider(spOptions),
    idp: new saml2.IdentityProvider(idpOptions),
  }

  return providers
}

export default defineEventHandler(async (event: H3Event) => {
  const urlObj = getRequestURL(event)

  const segments = urlObj.pathname.split('/').filter(Boolean)
  const samlIndex = segments.indexOf('saml')
  const apiIndex = segments.indexOf('api')

  if (samlIndex !== -1) {
    const { sp, idp } = getProviders()
    const samlAction = segments[samlIndex + 1]

    switch (samlAction) {
      case 'login':
        return new Promise((resolve, reject) => {
          sp.create_login_request_url(
            idp,
            {},
            (err: Error | null, login_url: string) => {
              if (err) {
                return reject(
                  createError({ statusCode: 500, statusMessage: err.message }),
                )
              }
              return resolve(sendRedirect(event, login_url))
            },
          )
        })

      case 'assert': {
        const method = (event.method ?? 'GET').toUpperCase()
        if (method !== 'POST' && method !== 'GET') {
          throw createError({
            statusCode: 405,
            statusMessage:
              'SAML assert endpoint only accepts POST or GET from the IdP. Start login at /saml/login.',
          })
        }

        const requestPayload =
          method === 'POST' ? await readBody(event) : getQuery(event)

        const hasSamlPayload =
          typeof requestPayload === 'object' &&
          requestPayload !== null &&
          ('SAMLResponse' in requestPayload || 'SAMLRequest' in requestPayload)

        if (!hasSamlPayload) {
          const queryKeys =
            typeof requestPayload === 'object' && requestPayload !== null
              ? Object.keys(requestPayload as Record<string, unknown>)
              : []
          throw createError({
            statusCode: 400,
            statusMessage:
              `SAML callback missing SAMLResponse/SAMLRequest on ${method} ${urlObj.pathname}. ` +
              `Query keys: [${queryKeys.join(', ')}]. ` +
              'Check IdP Reply URL/ACS and binding configuration.',
          })
        }

        return new Promise((resolve, reject) => {
          const onAssert = async (err: Error | null, samlResponse: any) => {
            let samlUser: any
            let name_id: any
            let session_index: any

            try {
              if (err) {
                return reject(
                  createError({ statusCode: 500, statusMessage: err.message }),
                )
              }

              // Save name_id and session_index for logout.
              const extracted = samlResponse.user
              name_id = extracted.name_id
              session_index = extracted.session_index
              samlUser = extracted.attributes

              // Log only attribute keys by default to avoid leaking PII in logs.
              const samlAttributeKeys = Object.keys(samlUser || {})
              console.log(
                '[SAML] attribute keys:',
                samlAttributeKeys.join(', '),
              )

              // Allow full attribute logging only when explicitly enabled for debugging.
              if (process.env.SAML_DEBUG_ATTRIBUTES === 'true') {
                console.log(
                  '[SAML] raw attributes:',
                  JSON.stringify(samlResponse.user.attributes, null, 2),
                )
              }

              // Normalize attributes — flatten single-element arrays and remap namespaced keys.
              for (const field in samlUser) {
                if (
                  Array.isArray(samlUser[field]) &&
                  samlUser[field].length === 1
                ) {
                  samlUser[field] = samlUser[field][0]
                }
                const friendlyName = FIELD_MAP[field]
                if (friendlyName) {
                  samlUser[friendlyName] = samlUser[field]
                }
                if (field.substring(0, 7) === 'http://') {
                  delete samlUser[field]
                }
              }

              // Validate email exists.
              if (!('oracleUser' in samlUser) && !samlUser.email) {
                return reject(
                  createError({
                    statusCode: 500,
                    statusMessage: `SAML response has no email or oracleUser. Keys present: ${Object.keys(samlUser).join(', ')}`,
                  }),
                )
              }

              const username =
                'oracleUser' in samlUser
                  ? samlUser.oracleUser
                  : lookupOracleUser(samlUser.email)

              const roles = await getRoles(
                username,
                samlUser.email as string | undefined,
              )

              // Look up the user and create the session payload.
              const user: Record<string, unknown> = {
                ...samlUser,
                username,
                roles,
                lastLogin: new Date(),
                name_id,
                session_index,
              }

              const isAdmin = roles.includes('Admin')
              const isFaculty = roles.includes('Faculty')
              if (!isAdmin && !isFaculty) {
                return reject(
                  createError({
                    statusCode: 403,
                    statusMessage: 'Access denied',
                  }),
                )
              }

              // See if this user exists in the Users collection.
              const existingUser = await UsersCollection.findOne({
                username: user.username,
              })
              if (!existingUser) {
                const createdUser = await UsersCollection.create(user)
                user._id = createdUser._id?.toString?.() || createdUser._id
              } else {
                user._id = existingUser._id?.toString?.() || existingUser._id
                await UsersCollection.updateOne({ _id: existingUser._id }, user)
              }

              await setUserSession(event, { user, loggedInAt: Date.now() })

              try {
                const clientIp = getClientIp(event)
                await logAuthEvent(
                  String(user.username ?? user._id ?? 'unknown'),
                  'LOGIN_SUCCESS',
                  clientIp,
                  'SAML assertion success',
                )
              } catch (auditErr) {
                // Do not block login on audit failures; log to console for diagnostics.
                console.error(
                  '[AUDIT] failed to record login success',
                  auditErr,
                )
              }

              const baseUrl =
                process.env.SAML_REDIRECT_TO?.replace(/\/$/, '') || ''
              const redirectTo = isAdmin
                ? `${baseUrl}/admin/admin_dashboard`
                : `${baseUrl}/faculty/faculty_dashboard`
              return resolve(sendRedirect(event, redirectTo))
            } catch (e: any) {
              try {
                let attemptedId = 'unknown'
                if (samlUser) {
                  if (samlUser.oracleUser) {
                    attemptedId = samlUser.oracleUser
                  } else if (samlUser.email) {
                    // Normalize email to covenantId format (local part lowercased) to avoid PII in audit logs
                    attemptedId = samlUser.email
                      .substring(0, samlUser.email.indexOf('@'))
                      .toLowerCase()
                  }
                }
                const clientIp = getClientIp(event)
                await logAuthEvent(
                  String(attemptedId),
                  'LOGIN_FAILURE',
                  clientIp,
                  e?.message ?? 'SAML assertion error',
                )
              } catch (auditErr) {
                console.error(
                  '[AUDIT] failed to record login failure',
                  auditErr,
                )
              }

              return reject(
                createError({
                  statusCode: 500,
                  statusMessage:
                    e?.message || 'Unexpected error during SAML assertion',
                }),
              )
            }
          }

          if (method === 'POST') {
            return sp.post_assert(
              idp,
              { request_body: requestPayload },
              onAssert,
            )
          }
          return sp.redirect_assert(
            idp,
            { request_body: requestPayload },
            onAssert,
          )
        })
      }

      case 'logout': {
        const query = getQuery(event)
        return new Promise((resolve, reject) => {
          sp.create_logout_request_url(
            idp,
            query,
            (err: Error | null, logoutRequestUrl: string) => {
              if (err) {
                return reject(
                  createError({ statusCode: 500, statusMessage: err.message }),
                )
              }
              return resolve(sendRedirect(event, logoutRequestUrl))
            },
          )
        })
      }

      case 'manifest.xml':
        setResponseHeaders(event, {
          'Content-Disposition': 'attachment; filename=manifest.xml',
          'Content-Type': 'text/xml; charset=latin1',
        })
        return sp.create_metadata()

      default:
        return
    }
  }

  if (apiIndex !== -1 && !urlObj.pathname.endsWith('/api/_auth/session')) {
    const session = await requireUserSession(event)
    const roles: string[] = (session.user as any).roles ?? []
    const username: string = (session.user as any).username ?? ''
    const email: string | undefined = (session.user as any).email
    const method = (event.method ?? 'GET').toUpperCase()

    if (!username) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Session missing user identity',
      })
    }

    const isRegistrar = roles.includes('Admin')
    const isFaculty = roles.includes('Faculty')

    if (!isRegistrar && !isFaculty) {
      throw createError({ statusCode: 403, statusMessage: 'Access denied' })
    }

    const isRegistrarOnly = REGISTRAR_ONLY.some((route) =>
      urlObj.pathname.startsWith(route),
    )
    const isFacultyReadOnly = FACULTY_READ_ONLY.some((route) =>
      urlObj.pathname.startsWith(route),
    )
    const isFacultyRoute = FACULTY_OR_REGISTRAR.some((route) =>
      urlObj.pathname.startsWith(route),
    )

    const covenantId = covenantIdFromEmail(email) ?? username.toLowerCase()

    const appRoles = roles.filter(
      (role): role is UserRole => role === 'Admin' || role === 'Faculty',
    )

    // Expose auth context so downstream route handlers and audit logging can use it.
    // `role` remains the primary role for behavior branches, while `roles`
    // preserves the full set for access checks.
    const primaryRole: UserRole = isRegistrar ? 'Admin' : 'Faculty'
    const authCtx: AuthContext = {
      userId: covenantId,
      role: primaryRole,
      roles: appRoles,
    }
    event.context.auth = authCtx

    if (isRegistrarOnly && !isRegistrar) {
      throw createError({ statusCode: 403, statusMessage: 'Access denied' })
    }

    if (isFacultyReadOnly && method !== 'GET' && !isRegistrar) {
      throw createError({ statusCode: 403, statusMessage: 'Access denied' })
    }

    if (isFacultyRoute && !isFaculty && !isRegistrar) {
      throw createError({ statusCode: 403, statusMessage: 'Access denied' })
    }
  }
})
