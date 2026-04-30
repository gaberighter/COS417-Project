<template>
  <div class="login-page">
    <section class="login-hero">
      <div class="login-card">
        <p class="login-eyebrow">Covenant College</p>
        <h1>Welcome to CovClasses</h1>
        <p class="login-subtitle">Login to submit your course preferences</p>
        <button
          class="login-button"
          :disabled="isLoading"
          @click="loginWithSso"
        >
          {{ isLoading ? 'Redirecting...' : 'Login with Microsoft' }}
        </button>
        <p v-if="error" class="error">{{ error }}</p>
      </div>
    </section>
  </div>
  <div class="temporary-debug-buttons">
    <button @click="redirectToAdmin">Admin Page</button>
    <button @click="redirectToFaculty">Faculty Page</button>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  pageTitle: 'Login',
  hideTopBar: true,
})

const { loginWithSso, isLoading, error } = useAuth()
const { redirectToAdmin, redirectToFaculty } = useDebugNavigation()
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.5rem;
  background:
    radial-gradient(circle at top, rgba(0, 51, 153, 0.08), transparent 45%),
    linear-gradient(135deg, rgba(0, 51, 153, 0.04), rgba(254, 254, 254, 0.9));
}

.login-page::before {
  content: '';
  position: absolute;
  width: min(520px, 70vw);
  height: min(520px, 70vw);
  background: radial-gradient(circle, rgba(0, 51, 153, 0.18), transparent 70%);
  border-radius: 50%;
  top: -120px;
  right: -140px;
  pointer-events: none;
  z-index: 0;
}

.login-hero {
  position: relative;
  width: min(520px, 100%);
  z-index: 1;
}

.login-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 18px;
  padding: 2.5rem 2.75rem;
  box-shadow: 0 24px 50px var(--color-shadow);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  animation: fade-up 500ms ease-out;
}

.login-card h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 2.6rem);
  color: var(--color-text-primary);
  font-family: 'Merriweather', 'Georgia', serif;
}

.login-eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-text-muted);
}

.login-subtitle {
  margin: 0;
  font-size: 1.05rem;
  color: var(--color-text-secondary);
}

.login-button {
  width: 100%;
  padding: 0.85rem 1.1rem;
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease;
  animation: fade-up 600ms ease-out 120ms both;
}

.login-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(0, 51, 153, 0.2);
}

.error {
  color: var(--color-text-danger);
  margin-top: 0.75rem;
}

@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-card,
  .login-button {
    animation: none;
  }

  .login-button {
    transition: none;
  }

  .login-button:hover:not(:disabled) {
    transform: none;
  }
}
</style>
