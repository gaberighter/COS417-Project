<template>
  <div id="admin-dashboard">
    <div class="button-wrapper">
      <button @click="viewExistingSchedule">View Existing Schedule</button>
    </div>
    <div class="button-wrapper">
      <button @click="createNewSchedule">Create New Schedule</button>
    </div>
    <div class="button-wrapper">
      <button @click="viewRoomData">Manage Room Data</button>
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

<style>
#admin-dashboard {
  display: flex;
  flex-direction: column;
  align-items: left;
  gap: 20px;
}
</style>
