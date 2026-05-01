<template>
  <div class="dashboard-page">
    <div class="dashboard-actions">
      <button class="dashboard-button" @click="manageCoursePreferences">
        Manage Course Preferences
      </button>
    </div>
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

const { manageCoursePreferences } = useFaculty()
const { redirectToLogin, redirectToAdmin } = useDebugNavigation()
</script>
