import { defineStore } from 'pinia'
import type { User } from '~~/types/User'

interface PrefType {
  field: string
  value: unknown
}

export const useUserStore = defineStore('user', () => {
  const _id = ref('')
  const username = ref('')
  const roles = ref<string[]>([])
  const bannerId = ref('')
  const pidm = ref('')
  const email = ref('')
  const name = ref('')
  const preferred = ref('')
  const last = ref('')
  const photo = ref('')
  const title = ref('')
  const sessionTimeout = ref(0)
  const preferences = ref<PrefType[]>([])

  function setUser(user?: User) {
    if (!user) return
    if ('_id' in user) _id.value = user._id ?? ''
    if ('username' in user) username.value = user.username
    if ('roles' in user) roles.value = user.roles
    if ('bannerId' in user) bannerId.value = user.bannerId ?? ''
    if ('pidm' in user) pidm.value = user.pidm ?? ''
    if ('email' in user) email.value = user.email ?? ''
    if ('name' in user) name.value = user.name ?? ''
    if ('preferred' in user) preferred.value = user.preferred ?? ''
    if ('last' in user) last.value = user.last ?? ''
  }
  async function logout() {
    const { user, clear } = useUserSession()

    const sessionUser = (user.value || {}) as Record<string, string>
    const name_id = sessionUser.name_id || ''
    const session_index = sessionUser.session_index || ''

    await clear()
    const query = new URLSearchParams({
      name_id,
      session_index,
    }).toString()
    document.location = `/saml/logout?${query}`
  }

  function extendSession() {
    const dt = new Date()
    dt.setMinutes(dt.getMinutes() + 15)
    sessionTimeout.value = dt.getTime()
  }

  return {
    _id,
    username,
    roles,
    bannerId,
    pidm,
    email,
    name,
    preferred,
    last,
    photo,
    title,
    sessionTimeout,
    preferences,
    setUser,
    logout,
    extendSession,
  }
})
