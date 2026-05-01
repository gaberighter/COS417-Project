export const useFaculty = () => {
  const viewChangePreferences = async () => {
    await navigateTo('/faculty/preferences')
  }

  const addNewPreference = async () => {
    await navigateTo('/faculty/preferences')
  }

  return { viewChangePreferences, addNewPreference }
}
