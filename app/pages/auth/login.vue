<template>
  <div class="login">
    <h1>Login</h1>
    <button :disabled="isLoading" @click="loginWithSso">
      {{ isLoading ? 'Redirecting...' : 'Login with SSO' }}
    </button>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  pageTitle: 'Login',
  hideTopBar: true,
})

const { loginWithSso, isLoading, error } = useAuth()
</script>

<style>
.error {
  color: var(--color-text-danger);
  margin-top: 0.75rem;
}
</style>
