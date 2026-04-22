#!/usr/bin/env node

/**
 * API Test Runner
 * Starts the dev server and runs the API test suite
 */

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import { setTimeout as sleep } from 'timers/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`)
}

async function main() {
  log('🚀 Starting Nuxt dev server...')

  const server = spawn('npm', ['run', 'dev'], {
    cwd: repoRoot,
    stdio: 'inherit',
  })

  // Wait for server to start
  log('⏳ Waiting for server to start (5 seconds)...')
  await sleep(5000)

  log('🧪 Running API test suite...')

  // Run the test script
  const testProcess = spawn('node', ['scripts/test-api-endpoints.mjs'], {
    cwd: repoRoot,
    stdio: 'inherit',
  })

  return new Promise((resolve) => {
    testProcess.on('close', (code) => {
      log(`✓ Tests completed with exit code: ${code}`)
      server.kill('SIGTERM')
      resolve(code)
    })
  })
}

main().then((code) => {
  process.exit(code)
})