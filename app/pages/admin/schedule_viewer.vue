<template>
    <div class="schedule-viewer">
        <h1>Schedule Viewer</h1>
        <div class="schedule-list">
            <p>Schedule viewing functionality goes here.</p>
        </div>
        <div class="schedule-content">
            <p>Selected schedule content will be displayed here.</p>
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
.schedule-viewer {
    max-width: 1000px;
    margin: 0 auto;
    padding: 16px;
}
</style>