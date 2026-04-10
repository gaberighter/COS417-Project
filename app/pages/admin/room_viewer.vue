<template>
    <div class="room-viewer">
        <h1>Room Viewer</h1>
        <div class="room-search">
            <p>Room search functionality goes here.</p>
        </div>
        <div class="room-content">
            <p>Room viewer content goes here.</p>
        </div>
    </div>
    <div class="temporary-debug-buttons">
        <button @click="redirectToLogin">Login Page</button>
        <button @click="redirectToAdmin">Admin Page</button>
    </div>
</template>

<script setup lang="ts">
const { redirectToLogin, redirectToAdmin } = useDebugNavigation()
</script>

<style>
</style>