import { APP_BASE_PATH } from './shared/app-config'
import Aura from '@primeuix/themes/aura'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@pinia/nuxt', 'nuxt-auth-utils', '@primevue/nuxt-module'],
  css: ['primeicons/primeicons.css', '~/assets/css/global.css'],
  nitro: {
    externals: {
      inline: ['xlsx'],
    },
  },
  primevue: {
    options: {
      ripple: false,
      inputVariant: 'filled',
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: '[data-theme="dark"]',
          cssLayer: false,
        },
      },
    },
  },
  app: {
    baseURL: `${APP_BASE_PATH}/`,
  },
  devtools: { enabled: true },
})
