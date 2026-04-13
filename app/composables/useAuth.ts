type AuthUser = Record<string, unknown>

export const useAuth = () => {
  // TODO: Replace with your real external SSO login URL.
  const SSO_LOGIN_URL = 'https://example.com/sso-login'

  const token = useState<string | null>('auth-token', () => null)
  const user = useState<AuthUser | null>('auth-user', () => null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => Boolean(token.value))

  const loginWithSso = async () => {
    error.value = null
    await navigateTo(SSO_LOGIN_URL, { external: true })
  }

  const logout = async () => {
    token.value = null
    user.value = null
    await navigateTo('/auth/login')
  }

  return {
    token,
    user,
    error,
    isLoading,
    isAuthenticated,
    loginWithSso,
    logout,
  }
}
