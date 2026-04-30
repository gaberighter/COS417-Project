export const useFaculty = () => {
  const viewChangePreferences = async () => {}

  const addNewPreference = async () => {}

  const importPreferencesCsv = async (file: File | null) => {
    if (!file) {
      return {
        ok: false,
        message: 'Please choose a CSV file before importing.',
      }
    }

    return {
      ok: true,
      message: `Selected ${file.name}. CSV import is not connected yet.`,
    }
  }

  return { viewChangePreferences, addNewPreference, importPreferencesCsv }
}
