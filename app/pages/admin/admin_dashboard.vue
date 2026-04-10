<template>
    <div class="admin-dashboard">
        <h1>Admin Dashboard</h1>
        <div class="admin-button-wrapper"">
            <button @click="viewExistingSchedule">View Existing Schedule</button>
        </div>
    </div>
    <div class="temporary-debug-buttons">
        <h1>Temporary Debug Buttons</h1>
        <button @click="redirectToLogin">Login Page</button>
        <button @click="redirectToFaculty">Faculty Page</button>
    </div>
</template>

<script setup lang="ts">
const { viewExistingSchedule } = useAdmin()
const { redirectToLogin, redirectToFaculty } = useDebugNavigation()
</script>

<style>
#admin-dashboard {
    display: flex;
}
.admin-button-wrapper {
    justify-content: center;
}
</style>