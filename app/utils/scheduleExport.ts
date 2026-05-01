export type ScheduleExportFormat = 'csv' | 'xlsx'

function extensionForFormat(format: ScheduleExportFormat): string {
  return format === 'xlsx' ? 'xlsx' : 'csv'
}

export async function downloadScheduleExport(
  term: string,
  runNumber: number,
  format: ScheduleExportFormat,
) {
  const exportUrl = `/api/schedule/${encodeURIComponent(term)}/export?runNumber=${runNumber}&format=${format}`
  const response = await fetch(exportUrl, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `schedule_${term}_run_${runNumber}.${extensionForFormat(format)}`
  anchor.click()
  URL.revokeObjectURL(url)
}
