<template>
  <div class="dashboard-page">
    <div class="dashboard-actions">
      <button class="dashboard-button" @click="viewExistingSchedule">
        View Existing Schedule
      </button>
      <button class="dashboard-button" @click="createNewSchedule">
        Create New Schedule
      </button>
      <button class="dashboard-button" @click="viewRoomData">
        Manage Room Data
      </button>
    </div>
  </div>
  <div class="temporary-debug-buttons">
    <button @click="redirectToLogin">Login Page</button>
    <button @click="redirectToFaculty">Faculty Page</button>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  pageTitle: 'Admin Dashboard',
})

const { viewExistingSchedule, createNewSchedule, viewRoomData } = useAdmin()
const { redirectToLogin, redirectToFaculty } = useDebugNavigation()
</script>
