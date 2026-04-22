import { APP_BASE_PATH } from '../../shared/app-config'

export const DEFAULT_MONGO_DB_NAME = 'COS417'

export type MongoDbSource = 'uri' | 'env' | 'default'

export interface MongoConnectionConfig {
  uri: string
  dbName: string
  dbNameSource: MongoDbSource
}

export interface MongoDiagnostics {
  appBasePath: string
  dbName: string
  dbNameSource: MongoDbSource
}

function getEnvDbName(): string | undefined {
  const candidates = [
    process.env.MONGO_DB_NAME,
    process.env.MONGODB_DB_NAME,
    process.env.MONGO_DB,
  ]

  for (const candidate of candidates) {
    const value = candidate?.trim()
    if (value) {
      return value
    }
  }

  return undefined
}

function extractDatabaseName(uri: string): string | undefined {
  let parsed: URL

  try {
    parsed = new URL(uri)
  } catch {
    throw new Error('MONGO_URI must be a valid MongoDB connection string')
  }

  if (parsed.protocol !== 'mongodb:' && parsed.protocol !== 'mongodb+srv:') {
    throw new Error('MONGO_URI must start with mongodb:// or mongodb+srv://')
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))
  return databaseName || undefined
}

export function resolveMongoConnectionConfig(): MongoConnectionConfig {
  const uri = process.env.MONGO_URI?.trim()
  if (!uri) {
    throw new Error('MONGO_URI is required to connect to MongoDB')
  }

  const dbNameFromUri = extractDatabaseName(uri)
  const dbNameFromEnv = getEnvDbName()

  const fallbackDbName = dbNameFromEnv ?? DEFAULT_MONGO_DB_NAME

  return {
    uri,
    dbName: dbNameFromUri ?? fallbackDbName,
    dbNameSource: dbNameFromUri ? 'uri' : dbNameFromEnv ? 'env' : 'default',
  }
}

export function getMongoDiagnostics(): MongoDiagnostics {
  const config = resolveMongoConnectionConfig()

  return {
    appBasePath: APP_BASE_PATH,
    dbName: config.dbName,
    dbNameSource: config.dbNameSource,
  }
}
