<template>
  <div class="admin-dashboard">
    <h1>Admin Dashboard</h1>
    <p>Admin dashboard content goes here.</p>
  </div>
  <div class="temporary-debug-buttons">
    <h1>Temporary Debug Buttons</h1>
    <button @click="redirectToLogin">Login Page</button>
    <button @click="redirectToFaculty">Faculty Page</button>
  </div>
</template>

<script setup lang="ts">
const { redirectToLogin, redirectToFaculty } = useDebugNavigation()
</script>
