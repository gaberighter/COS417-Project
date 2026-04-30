export const useAdmin = () => {
  const viewExistingSchedule = async () => {
    await navigateTo('/admin/schedule_viewer')
  }

  const createNewSchedule = () => {}

  const viewRoomData = async () => {
    await navigateTo('/admin/room_viewer')
  }

  const viewProfessorData = async () => {
    await navigateTo('/admin/professor_viewer')
  }

  const viewCourseCatalog = async () => {
    await navigateTo('/admin/course_catalog_viewer')
  }

  const viewAuditLogs = async () => {
    await navigateTo('/admin/audit_log_viewer')
  }

  return {
    viewExistingSchedule,
    createNewSchedule,
    viewRoomData,
    viewProfessorData,
    viewCourseCatalog,
    viewAuditLogs,
  }
}
