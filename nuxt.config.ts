// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  app: {
    baseURL: '/COS170/'
  },
  routeRules: {
    '/': { redirect: '/auth/login' }
  },
  devtools: { enabled: true }
})
