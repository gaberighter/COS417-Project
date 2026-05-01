export const useFaculty = () => {
  const manageCoursePreferences = async () => {
    await navigateTo('/faculty/preferences')
  }

  return { manageCoursePreferences }
}
