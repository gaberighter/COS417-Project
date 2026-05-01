export const useAuth = () => {
  const { user, loggedIn, fetch: refreshSession, clear } = useUserSession()

  const SSO_LOGIN_URL = '/saml/login'
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => loggedIn.value)

  const loginWithSso = async () => {
    await navigateTo(SSO_LOGIN_URL, { external: true })
  }

  const logout = async () => {
    await clear()
    await navigateTo('/auth/login')
  }

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    loginWithSso,
    logout,
    refreshSession,
  }
}
