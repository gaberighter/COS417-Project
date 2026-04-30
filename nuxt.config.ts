import { APP_BASE_PATH } from './shared/app-config'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@pinia/nuxt', 'nuxt-auth-utils'],
  css: ['~/assets/css/global.css'],
  app: {
    baseURL: `${APP_BASE_PATH}/`,
  },
  devtools: { enabled: true },
})
