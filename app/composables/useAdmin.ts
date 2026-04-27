export const useAdmin = () => {
  const viewExistingSchedule = async () => {
    await navigateTo('/admin/schedule_viewer')
  }

  const createNewSchedule = () => {}

  const viewRoomData = async () => {
    await navigateTo('/admin/room_viewer')
  }

  return { viewExistingSchedule, createNewSchedule, viewRoomData }
}
