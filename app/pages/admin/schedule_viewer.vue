<template>
    <div class="schedule-viewer">
        <h1>Schedule Viewer</h1>
        <div class="schedule-list">
            <p>List of schedules goes here.</p>
        </div>
        <div class="schedule-content">
            <p>Schedule viewer content goes here.</p>
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