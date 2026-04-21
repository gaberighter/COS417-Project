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

  try {
    await connectDB()
    console.info(
      `[startup] mongoConnection=success mongoDb=${diagnostics.dbName}`,
    )
  } catch (error) {
    console.error(
      `[startup] mongoConnection=failure mongoDb=${diagnostics.dbName} reason=${describeError(error)}`,
    )
    throw error
  }
})
