export const useDebugNavigation = () => {
  const redirectToAdmin = async () => {
    console.log("Trying to go to Admin!!")
    await navigateTo('/admin/admin_dashboard')
  }

  const redirectToFaculty = async () => {
    await navigateTo('/faculty/faculty_dashboard')
  }

  const redirectToLogin = async () => {
    await navigateTo('/auth/login')
  }

  return {
    redirectToAdmin,
    redirectToFaculty,
    redirectToLogin,
  }
}
