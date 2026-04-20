// server/utils/db.ts
// Singleton MongoDB connection via Mongoose — §10.1 / §5.1
//
// Usage (in any server route or service):
//   import { connectDB } from "~/server/utils/db";
//   await connectDB();

import mongoose from 'mongoose'
import { initializeModelIndexes } from '../models/index'

type MongoCache = {
  connection: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
  indexesReadyPromise: Promise<void> | null
  listenersAttached: boolean
}

const globalForMongo = globalThis as typeof globalThis & {
  __mongoCache?: MongoCache
}

const mongoCache: MongoCache = globalForMongo.__mongoCache ?? {
  connection: null,
  promise: null,
  indexesReadyPromise: null,
  listenersAttached: false,
}

globalForMongo.__mongoCache = mongoCache

function getMongoUri(): string {
  const uri = process.env.MONGO_URI
  if (uri) return uri

  const message = 'MONGO_URI is required to connect to MongoDB'
  if (process.env.NODE_ENV === 'production') {
    throw new Error(message)
  }

  throw new Error(`${message} in this environment`)
}

export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState !== 1) {
    mongoCache.connection = null
  }

  if (mongoCache.connection && mongoose.connection.readyState === 1) {
    return mongoCache.connection
  }

  if (!mongoCache.promise) {
    const uri = getMongoUri()
    mongoCache.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
      })
      .catch((error) => {
        mongoCache.promise = null
        mongoCache.connection = null
        mongoCache.indexesReadyPromise = null
        throw error
      })
  }

  mongoCache.connection = await mongoCache.promise

  if (!mongoCache.listenersAttached) {
    mongoose.connection.on('disconnected', () => {
      mongoCache.connection = null
      mongoCache.promise = null
      mongoCache.indexesReadyPromise = null
    })
    mongoose.connection.on('error', () => {
      mongoCache.connection = null
      mongoCache.promise = null
      mongoCache.indexesReadyPromise = null
    })
    mongoCache.listenersAttached = true
  }

  if (!mongoCache.indexesReadyPromise) {
    mongoCache.indexesReadyPromise = initializeModelIndexes().catch((error) => {
      mongoCache.indexesReadyPromise = null
      throw error
    })
  }

  await mongoCache.indexesReadyPromise
  return mongoCache.connection
}
