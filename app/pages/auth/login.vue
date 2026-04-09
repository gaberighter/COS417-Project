<template>
    <div class="login">
        <button :disabled="isLoading" @click="loginWithSso">
            {{ isLoading ? 'Redirecting...' : 'Login with SSO' }}
        </button>
        <p v-if="error" class="error">{{ error }}</p>
    </div>
</template>

<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

const { loginWithSso, isLoading, error } = useAuth()
</script>

<style>
.error {
    color: #c31b1b;
    margin-top: 0.75rem;
}
</style>