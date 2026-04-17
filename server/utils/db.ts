// server/utils/db.ts
// Singleton MongoDB connection via Mongoose — §10.1 / §5.1
//
// Usage (in any server route or service):
//   import { connectDB } from "~/server/utils/db";
//   await connectDB();

import mongoose from 'mongoose'

type MongoCache = {
  connection: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

const globalForMongo = globalThis as typeof globalThis & {
  __mongoCache?: MongoCache
}

const mongoCache: MongoCache = globalForMongo.__mongoCache ?? {
  connection: null,
  promise: null,
}

globalForMongo.__mongoCache = mongoCache

function getMongoUri(): string {
  const uri = process.env.MONGO_URI
  if (uri) return uri

  const message =
    'MONGO_URI is required to connect to MongoDB'
  if (process.env.NODE_ENV === 'production') {
    throw new Error(message)
  }

  throw new Error(`${message} in this environment`)
}

export async function connectDB(): Promise<typeof mongoose> {
  if (mongoCache.connection && mongoose.connection.readyState === 1) {
    return mongoCache.connection
  }

  if (!mongoCache.promise) {
    const uri = getMongoUri()
    mongoCache.promise = mongoose.connect(uri, {
      bufferCommands: false,
    })
  }

  mongoCache.connection = await mongoCache.promise
  return mongoCache.connection
}
