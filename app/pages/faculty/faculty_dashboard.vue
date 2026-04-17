<template>
    <div class="faculty-dashboard">
        <p>Faculty dashboard content goes here.</p>
    </div>
    <div class="temporary-debug-buttons">
        <button @click="redirectToLogin">Login Page</button>
        <button @click="redirectToAdmin">Admin Page</button>
    </div>
</template>

<script setup lang="ts">
definePageMeta({
    pageTitle: 'Faculty Dashboard',
})

const { redirectToLogin, redirectToAdmin } = useDebugNavigation()

</script>