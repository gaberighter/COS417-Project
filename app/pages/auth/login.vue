<template>
    <div class="login">
        <h1>Login</h1>
        <button :disabled="isLoading" @click="loginWithSso">
            {{ isLoading ? 'Redirecting...' : 'Login with SSO' }}
        </button>
        <p v-if="error" class="error">{{ error }}</p>
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

<style>
.error {
    color: #c31b1b;
    margin-top: 0.75rem;
}
</style>