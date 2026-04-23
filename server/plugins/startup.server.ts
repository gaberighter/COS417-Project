import { defineNitroPlugin } from 'nitropack/runtime'
import { APP_BASE_PATH } from '../../shared/app-config'
import { connectDB } from '../utils/db'
import { getMongoDiagnostics } from '../utils/mongoConfig'

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export default defineNitroPlugin(async () => {
  const diagnostics = getMongoDiagnostics()

  console.info(
    `[startup] appBasePath=${APP_BASE_PATH} mongoDb=${diagnostics.dbName} dbNameSource=${diagnostics.dbNameSource}`,
  )

  // Do not block app startup on DB availability.
  void connectDB()
    .then(() => {
      console.info(
        `[startup] mongoConnection=success mongoDb=${diagnostics.dbName}`,
      )
    })
    .catch((error) => {
      console.error(
        `[startup] mongoConnection=failure reason=${describeError(error)}`,
      )
    })
})
