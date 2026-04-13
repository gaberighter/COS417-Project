// server/utils/db.ts
// Singleton MongoDB connection via Mongoose — §10.1 / §5.1
// STUB: connectDB is a no-op until MONGODB_URI is set in .env
//
// Usage (in any server route or service):
//   import { connectDB } from "~/server/utils/db";
//   await connectDB();

let connected = false;

export async function connectDB(): Promise<void> {
  if (connected) return;

  const uri = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.MONGODB_URI;
  if (!uri) {
    console.warn("[db] MONGODB_URI not set — running with in-memory stub data");
    connected = true; // skip real connection
    return;
  }

  // TODO: uncomment when mongoose is installed
  // const mongoose = await import("mongoose");
  // await mongoose.connect(uri);
  // connected = true;
  // console.log("[db] Connected to MongoDB");

  console.warn("[db] connectDB stub — replace with real mongoose.connect()");
  connected = true;
}