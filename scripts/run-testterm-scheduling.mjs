import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_BASE_URL = 'http://127.0.0.1:3000/COS417'
const DEFAULT_SAMPLE_SIZE = 350

function parseArgs(argv) {
  const get = (name) => {
    const index = argv.indexOf(name)
    if (index < 0) {
      return undefined
    }

    return argv[index + 1]
  }

  return {
    baseUrl: get('--base-url') ?? process.env.TESTTERM_BASE_URL ?? DEFAULT_BASE_URL,
    sampleSize: Number(get('--sample-size') ?? process.env.TESTTERM_SAMPLE_SIZE ?? DEFAULT_SAMPLE_SIZE),
    outputFilePath: get('--output-file') ?? process.env.TESTTERM_OUTPUT_FILE,
    cookie: get('--cookie') ?? process.env.TESTTERM_COOKIE,
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2))
  const endpoint = `${args.baseUrl.replace(/\/+$/, '')}/api/schedule/backfill-and-run`

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-dev-role': 'Admin',
    'x-dev-user': 'admin.test',
  }

  if (args.cookie && args.cookie.trim().length > 0) {
    headers.Cookie = `nuxt-session=${args.cookie.trim()}`
  }

  const payload = {
    sampleSize: Number.isFinite(args.sampleSize) ? args.sampleSize : DEFAULT_SAMPLE_SIZE,
  }

  if (args.outputFilePath && args.outputFilePath.trim().length > 0) {
    payload.outputFilePath = args.outputFilePath
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  const text = await response.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`Expected JSON but received:\n${text}`)
  }

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}: ${JSON.stringify(json, null, 2)}`)
  }

  const timestamp = new Date().toISOString().replace(/[.:]/g, '-')
  const responseOutputPath = path.resolve(
    process.cwd(),
    'testterm-output',
    `testterm-http-response-${timestamp}.json`,
  )

  await mkdir(path.dirname(responseOutputPath), { recursive: true })
  await writeFile(responseOutputPath, JSON.stringify(json, null, 2), 'utf8')

  console.log(JSON.stringify({ ok: true, endpoint, responseOutputPath, result: json }, null, 2))
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
