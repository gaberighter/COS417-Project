// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@pinia/nuxt', 'nuxt-auth-utils'],
  app: {
    baseURL: '/COS417/',
  },
  devtools: { enabled: true },
})
