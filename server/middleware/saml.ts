import {
  H3Event,
  sendRedirect,
  defineEventHandler,
  createError,
  getRequestURL,
  getMethod,
  readBody,
  getQuery,
  setResponseHeaders,
} from 'h3'
import fs from 'fs'
// @ts-expect-error - saml2-js does not currently publish TypeScript definitions.
import saml2 from 'saml2-js'

import { Users } from '../models/user.model'
type SAMLProviders = {
  sp: InstanceType<typeof saml2.ServiceProvider>
  idp: InstanceType<typeof saml2.IdentityProvider>
}

const UsersCollection = Users as any

let providers: SAMLProviders | null = null

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

// Maps Microsoft/Azure AD namespaced SAML attribute keys to friendly names.
const FIELD_MAP: Record<string, string> = {
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'email',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname':
    'firstName',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname': 'lastName',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'displayName',
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
                  createError({
                    statusCode: 500,
                    statusMessage: err.message,
                  }),
                )
              }

              return resolve(sendRedirect(event, login_url))
            },
          )
        })
      case 'assert': {
        const method = getMethod(event)
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
            try {
              if (err) {
                return reject(
                  createError({
                    statusCode: 500,
                    statusMessage: err.message,
                  }),
                )
              }

              // Save name_id and session_index for logout.
              const {
                name_id,
                session_index,
                attributes: samlUser,
              } = samlResponse.user

              // Log only attribute keys by default to avoid leaking PII in logs.
              const samlAttributeKeys = Object.keys(samlUser || {})
              console.log('[SAML] attribute keys:', samlAttributeKeys.join(', '))

              // Allow full attribute logging only when explicitly enabled for debugging.
              if (process.env.SAML_DEBUG_ATTRIBUTES === 'true') {
                console.log(
                  '[SAML] raw attributes:',
                  JSON.stringify(samlResponse.user.attributes, null, 2),
                )
              }

              // Normalize attributes — flatten single-element arrays and remap
              // namespaced keys to friendly names BEFORE deleting http:// fields.
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

              // Look up the user from Banner to get their Oracle username.
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

              const roles = getRoles(username)

              // Look up the user and create the session payload.
              const user: Record<string, unknown> = {
                ...samlUser,
                username,
                roles,
                lastLogin: new Date(),
                name_id,
                session_index,
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

              await setUserSession(event, {
                user,
                loggedInAt: Date.now(),
              })

              return resolve(
                sendRedirect(event, process.env.SAML_REDIRECT_TO || '/'),
              )
            } catch (e: any) {
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
                  createError({
                    statusCode: 500,
                    statusMessage: err.message,
                  }),
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
    await requireUserSession(event)
  }
})

// The Oracle username is the first letter of the first name and then the last name, in all caps.
function lookupOracleUser(email: string) {
  return (
    email.substring(0, 1) +
    email.substring(email.indexOf('.') + 1, email.indexOf('@'))
  ).toUpperCase()
}

// Just a list of role names. Oracle roles are all-caps.
function getRoles(_user: string) {
  return ['REGISTRAR']
}
