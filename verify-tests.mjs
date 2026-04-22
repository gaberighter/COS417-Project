#!/usr/bin/env node

// Checklist: Verify all test files are in place
import fs from 'fs'
import path from 'path'

const files = [
  { path: 'scripts/test-api-endpoints.mjs', desc: 'Main test suite' },
  { path: 'scripts/test-api-runner.mjs', desc: 'Auto-start wrapper' },
  { path: 'scripts/TEST-GUIDE.sh', desc: 'Config reference' },
  { path: 'QUICK-TEST.md', desc: 'Quick start guide' },
  { path: 'TESTING.md', desc: 'Complete documentation' },
  { path: 'API-TEST-SUMMARY.md', desc: 'Technical details' },
  { path: 'TESTING-IMPLEMENTATION.md', desc: 'Implementation overview' },
]

console.log('\n📋 API Testing Suite Verification Checklist\n')
console.log('=' .repeat(60))

let allExist = true

for (const file of files) {
  const filePath = path.join(process.cwd(), file.path)
  const exists = fs.existsSync(filePath)
  const status = exists ? '✅' : '❌'
  const size = exists ? ` (${(fs.statSync(filePath).size / 1024).toFixed(1)} KB)` : ''
  
  console.log(`${status} ${file.path.padEnd(35)} - ${file.desc}${size}`)
  
  if (!exists) allExist = false
}

console.log('=' .repeat(60))

// Check package.json
const packagePath = path.join(process.cwd(), 'package.json')
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
const hasTestApi = !!pkg.scripts['test:api']
const hasTestApiOnly = !!pkg.scripts['test:api:only']

console.log('\n📦 Package.json Scripts\n')
console.log(`${hasTestApi ? '✅' : '❌'} npm run test:api`)
console.log(`${hasTestApiOnly ? '✅' : '❌'} npm run test:api:only`)

console.log('\n' + '=' .repeat(60))

if (allExist && hasTestApi && hasTestApiOnly) {
  console.log('\n✅ All test files created successfully!\n')
  console.log('📖 Next Steps:\n')
  console.log('1. Start testing with:')
  console.log('   npm run test:api\n')
  console.log('2. Or read the quick start:')
  console.log('   cat QUICK-TEST.md\n')
  console.log('3. For detailed docs:')
  console.log('   cat TESTING.md\n')
  process.exit(0)
} else {
  console.log('\n❌ Some files are missing!\n')
  process.exit(1)
}