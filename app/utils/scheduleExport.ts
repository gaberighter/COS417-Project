export type ScheduleExportFormat = 'csv' | 'xlsx'

function extensionForFormat(format: ScheduleExportFormat): string {
  return format === 'xlsx' ? 'xlsx' : 'csv'
}

export async function downloadScheduleExport(
  term: string,
  runNumber: number,
  format: ScheduleExportFormat,
) {
  const runtimeConfig = useRuntimeConfig()
  const basePath = (runtimeConfig.app.baseURL || '/').replace(/\/$/, '')
  const exportUrl = `${basePath}/api/schedule/${encodeURIComponent(term)}/export?runNumber=${runNumber}&format=${format}&_ts=${Date.now()}`
  const response = await fetch(exportUrl, {
    credentials: 'include',
    cache: 'no-store',
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
