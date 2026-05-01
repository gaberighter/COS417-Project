export const useAuth = () => {
  const { user, loggedIn, fetch: refreshSession } = useUserSession()

  const SSO_LOGIN_URL = '/saml/login'

  const isAuthenticated = computed(() => loggedIn.value)

  const loginWithSso = async () => {
    await navigateTo(SSO_LOGIN_URL, { external: true })
  }

  const logout = async () => {
    await $fetch('/api/_auth/session', { method: 'DELETE' })
    await navigateTo('/auth/login')
  }

  return {
    user,
    isAuthenticated,
    loginWithSso,
    logout,
    refreshSession,
  }
}
