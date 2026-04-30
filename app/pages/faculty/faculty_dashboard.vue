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
    <div class="button-wrapper">
      <label class="import-label" for="preferences-csv-input">
        Import Preferences CSV
      </label>
      <input
        id="preferences-csv-input"
        ref="csvInput"
        class="csv-input"
        type="file"
        accept=".csv,text/csv"
        @change="handleCsvSelection"
      />
      <button :disabled="!selectedFileName" @click="handleCsvImport">
        {{ importButtonLabel }}
      </button>
      <p v-if="selectedFileName" class="import-status">Selected: {{ selectedFileName }}</p>
      <p v-if="importStatus" class="import-status">{{ importStatus }}</p>
    </div>
  </div>
  <div class="temporary-debug-buttons">
    <button @click="redirectToLogin">Login Page</button>
    <button @click="redirectToAdmin">Admin Page</button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

definePageMeta({
  pageTitle: 'Faculty Dashboard',
})

const { viewChangePreferences, addNewPreference, importPreferencesCsv } =
  useFaculty()
const { redirectToLogin, redirectToAdmin } = useDebugNavigation()

const csvInput = ref<HTMLInputElement | null>(null)
const selectedFileName = ref('')
const importStatus = ref('')

const importButtonLabel = computed(() =>
  selectedFileName.value ? 'Stub Import CSV' : 'Choose a CSV first',
)

const handleCsvSelection = () => {
  const selectedFile = csvInput.value?.files?.[0] ?? null
  selectedFileName.value = selectedFile?.name ?? ''
  importStatus.value = ''
}

const handleCsvImport = async () => {
  const selectedFile = csvInput.value?.files?.[0] ?? null
  const result = await importPreferencesCsv(selectedFile)
  importStatus.value = result.message
}
</script>

<style>
.import-label {
  display: inline-block;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.csv-input {
  display: block;
  margin-bottom: 0.75rem;
}

.import-status {
  margin: 0.5rem 0 0;
  color: var(--color-text-secondary);
}
</style>
