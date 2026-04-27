<template>
  <div class="faculty-dashboard">
    <div class="button-wrapper">
      <button @click="viewChangePreferences">
        View/Change Existing Preferences
      </button>
    </div>
    <div class="button-wrapper">
      <button @click="addNewPreference">Enter Preferences</button>
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

const { viewChangePreferences, addNewPreference } = useFaculty()
const { redirectToLogin, redirectToAdmin } = useDebugNavigation()
</script>
