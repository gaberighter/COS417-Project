<template>
  <div class="app-shell">
    <NuxtRouteAnnouncer />
    <header v-if="isTopBarVisible" class="site-top-bar">
      <h1 class="site-top-bar__title">{{ currentPageTitle }}</h1>
      <div class="site-top-bar__actions">
        <button
          v-if="canShowDashboardAction"
          class="site-top-bar__auth-btn site-top-bar__auth-btn--secondary"
          @click="handleDashboardAction"
        >
          {{ dashboardActionLabel }}
        </button>
        <span v-if="isLoggedIn" class="site-top-bar__auth-context">
          {{ authContextLabel }}
        </span>
        <button
          v-if="!isLoggedIn"
          class="site-top-bar__auth-btn"
          @click="handleLogin"
        >
          Login
        </button>
        <button
          v-if="isLoggedIn && canShowProfileAction"
          class="site-top-bar__auth-btn site-top-bar__auth-btn--secondary"
          @click="handleProfileAction"
        >
          Profile
        </button>
        <button
          v-if="isLoggedIn && canShowLogoutAction"
          class="site-top-bar__auth-btn"
          @click="handleLogout"
        >
          Logout
        </button>
      </div>
    </header>
    <main class="app-content">
      <NuxtPage />
    </main>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const auth = useAuth() as Record<string, unknown>

const unwrapMaybeRef = (value: unknown) => {
  if (value && typeof value === 'object' && 'value' in value) {
    return (value as { value: unknown }).value
  }

  return value
}

const normalizeRoleLabel = (roleValue: string) => {
  return roleValue
    .replace(/[\/_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

const getFunction = (candidate: unknown) => {
  return typeof candidate === 'function' ? (candidate as () => unknown) : null
}

const isTopBarVisible = computed(() => {
  const hideTopBar = route.meta.hideTopBar

  if (typeof hideTopBar === 'boolean') {
    return !hideTopBar
  }

  return route.path !== '/auth/login'
})

const isLoggedIn = computed(() => {
  return Boolean(unwrapMaybeRef(auth.isAuthenticated))
})

const userData = computed(() => {
  const userCandidate = unwrapMaybeRef(auth.user)
  return userCandidate && typeof userCandidate === 'object'
    ? (userCandidate as Record<string, unknown>)
    : null
})

const userRole = computed(() => {
  const user = userData.value

  if (!user) {
    return null
  }

  const directRole = user.role ?? user.userRole

  if (typeof directRole === 'string' && directRole.trim().length > 0) {
    return normalizeRoleLabel(directRole)
  }

  if (Array.isArray(user.roles) && user.roles.length > 0) {
    const firstRole = user.roles.find(
      (role) => typeof role === 'string' && role.trim().length > 0,
    )

    if (typeof firstRole === 'string') {
      return normalizeRoleLabel(firstRole)
    }
  }

  return null
})

const authContextLabel = computed(() => {
  if (!isLoggedIn.value) {
    return ''
  }

  if (userRole.value) {
    return `Signed in as ${userRole.value}`
  }

  return 'Signed in'
})

const dashboardAction = computed(() => {
  const path = route.path ?? ''

  if (path.startsWith('/admin')) {
    return {
      label: 'Admin Dashboard',
      target: '/admin/admin_dashboard',
    }
  }

  if (path.startsWith('/faculty')) {
    return {
      label: 'Faculty Dashboard',
      target: '/faculty/faculty_dashboard',
    }
  }

  return null
})

const canShowDashboardAction = computed(() => {
  if (!dashboardAction.value) {
    return false
  }

  return route.path !== dashboardAction.value.target
})

const dashboardActionLabel = computed(() => {
  return dashboardAction.value?.label ?? ''
})

const canShowProfileAction = computed(() => {
  if (!isLoggedIn.value) {
    return false
  }

  return Boolean(
    getFunction(auth.goToProfile) ||
    getFunction(auth.navigateToProfile) ||
    getFunction(auth.openProfile) ||
    typeof auth.profileRoute === 'string',
  )
})

const canShowLogoutAction = computed(() => {
  return isLoggedIn.value && Boolean(getFunction(auth.logout))
})

const currentPageTitle = computed(() => {
  const metaTitle = route.meta.pageTitle ?? route.meta.title

  if (typeof metaTitle === 'string' && metaTitle.trim().length > 0) {
    return metaTitle
  }

  const fallbackSource =
    typeof route.name === 'string' && route.name.length > 0
      ? route.name
      : route.path

  return fallbackSource
    .toString()
    .replace(/[\/_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
})

const handleLogin = async () => {
  const loginAction = auth.login ?? auth.loginWithSso ?? auth.signIn
  const resolvedLoginAction = getFunction(loginAction)

  if (resolvedLoginAction) {
    await resolvedLoginAction()
  }
}

const handleLogout = async () => {
  const logoutAction = getFunction(auth.logout)

  if (logoutAction) {
    await logoutAction()
  }
}

const handleProfileAction = async () => {
  const profileAction =
    getFunction(auth.goToProfile) ??
    getFunction(auth.navigateToProfile) ??
    getFunction(auth.openProfile)

  if (profileAction) {
    await profileAction()
    return
  }

  if (typeof auth.profileRoute === 'string' && auth.profileRoute.length > 0) {
    await navigateTo(auth.profileRoute)
  }
}

const handleDashboardAction = async () => {
  if (!dashboardAction.value) {
    return
  }

  await navigateTo(dashboardAction.value.target)
}
</script>
