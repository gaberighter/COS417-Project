export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()
  /*
  // Redirect unauthenticated users to the login route.
  if (
    !loggedIn.value &&
    to.path !== '/auth/login' &&
    !to.path.startsWith('/saml')
  ) {
    return navigateTo('/auth/login')
  }
    */
})
