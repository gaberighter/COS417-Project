/**
 * AES-256-GCM Field-Level Encryption for MongoDB
 * 
 * Provides transparent encryption/decryption for sensitive document fields.
 * Uses AES-256-GCM with authenticated encryption (prevents tampering).
 * 
 * IMPLEMENTATION NOTES:
 * - GCM provides both confidentiality and authenticity
 * - Each encrypted value has a unique IV (initialization vector)
 * - Encrypted data is stored as: <base64(iv + ciphertext + tag)>
 * - Suitable for field-level encryption in MongoDB
 * 
 * USAGE (when enabled):
 *   const encrypted = encryptField('sensitive-data', 'fieldName')
 *   const decrypted = decryptField(encrypted, 'fieldName')
 */

import crypto from 'crypto'
import { encryptionConfigManager } from './encryptionConfig'

export interface EncryptedFieldMetadata {
  encrypted: boolean
  algorithm: string
  version: number
}

const ENCRYPTION_VERSION = 1
const GCM_TAG_LENGTH = 16 // 128 bits
const IV_LENGTH = 12 // 96 bits - standard for GCM

/**
 * Encrypt a field value using AES-256-GCM
 *
 * @param plaintext - The value to encrypt
 * @param fieldName - The field name (used for domain separation)
 * @returns Encrypted value as base64 string
 * @throws Error if encryption is disabled or fails
 */
export function encryptField(plaintext: string, fieldName: string): string {
  const config = encryptionConfigManager.getConfig()

  if (!config.enabled) {
    throw new Error(
      'Encryption is disabled. Set MONGO_ENCRYPTION_ENABLED=true to use encryption.'
    )
  }

  // Generate a random IV for each encryption
  const iv = crypto.randomBytes(IV_LENGTH)

  // Derive a field-specific key using PBKDF2 (domain separation)
  const fieldSpecificKey = crypto.pbkdf2Sync(
    config.masterKeyBuffer,
    Buffer.concat([config.keyDerivationSalt, Buffer.from(fieldName)]),
    100000, // iterations
    32, // keylen (AES-256)
    'sha256'
  )

  // Create cipher
  const cipher = crypto.createCipheriv(config.algorithm, fieldSpecificKey, iv)

  // Encrypt the plaintext
  let ciphertext = cipher.update(plaintext, 'utf8')
  ciphertext = Buffer.concat([ciphertext, cipher.final()])

  // Get authentication tag
  const tag = cipher.getAuthTag()

  // Combine: IV + ciphertext + tag
  const encrypted = Buffer.concat([iv, ciphertext, tag])

  // Return as base64
  return encrypted.toString('base64')
}

/**
 * Decrypt a field value encrypted with encryptField()
 *
 * @param encrypted - Encrypted value as base64 string
 * @param fieldName - The field name (must match encryption)
 * @returns Decrypted plaintext
 * @throws Error if decryption fails (corrupted data or tampering detected)
 */
export function decryptField(encrypted: string, fieldName: string): string {
  const config = encryptionConfigManager.getConfig()

  if (!config.enabled) {
    throw new Error(
      'Encryption is disabled. Set MONGO_ENCRYPTION_ENABLED=true to use encryption.'
    )
  }

  // Decode from base64
  const buffer = Buffer.from(encrypted, 'base64')

  // Extract components
  const iv = buffer.subarray(0, IV_LENGTH)
  const ciphertext = buffer.subarray(IV_LENGTH, buffer.length - GCM_TAG_LENGTH)
  const tag = buffer.subarray(buffer.length - GCM_TAG_LENGTH)

  // Derive the same field-specific key
  const fieldSpecificKey = crypto.pbkdf2Sync(
    config.masterKeyBuffer,
    Buffer.concat([config.keyDerivationSalt, Buffer.from(fieldName)]),
    100000,
    32,
    'sha256'
  )

  // Create decipher
  const decipher = crypto.createDecipheriv(config.algorithm, fieldSpecificKey, iv)

  // Set the authentication tag
  decipher.setAuthTag(tag)

  // Decrypt
  try {
    let plaintext = decipher.update(ciphertext)
    plaintext = Buffer.concat([plaintext, decipher.final()])
    return plaintext.toString('utf8')
  } catch (error) {
    // GCM will throw if the tag doesn't match (tampering detected)
    throw new Error(
      `Failed to decrypt field "${fieldName}". Data may be corrupted or tampered. ${error instanceof Error ? error.message : ''}`
    )
  }
}

/**
 * Check if a value appears to be encrypted
 * (Base64-encoded with appropriate length for IV + data + tag)
 */
export function isEncrypted(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false
  }

  try {
    const buffer = Buffer.from(value, 'base64')
    // Must be at least IV_LENGTH + GCM_TAG_LENGTH (1 byte minimum ciphertext)
    return buffer.length >= IV_LENGTH + GCM_TAG_LENGTH + 1
  } catch {
    return false
  }
}

/**
 * Create a Mongoose middleware for automatic encryption/decryption
 * 
 * USAGE (when ready to enable):
 *   const encryptionMiddleware = createEncryptionMiddleware(['ssn', 'email'])
 *   schema.pre('save', encryptionMiddleware.preSave)
 *   schema.post(/^find/, encryptionMiddleware.postFind)
 */
export function createEncryptionMiddleware(fieldNames: string[]) {
  return {
    preSave: function (next: (err?: Error) => void) {
      try {
        const config = encryptionConfigManager.getConfig()
        if (!config.enabled) {
          return next()
        }

        // Encrypt specified fields before saving
        for (const fieldName of fieldNames) {
          if (this[fieldName] !== undefined && this[fieldName] !== null) {
            const value = String(this[fieldName])
            if (!isEncrypted(value)) {
              this[fieldName] = encryptField(value, fieldName)
            }
          }
        }

        next()
      } catch (error) {
        next(error instanceof Error ? error : new Error(String(error)))
      }
    },

    postFind: function (docs: any[], next: (err?: Error) => void) {
      try {
        const config = encryptionConfigManager.getConfig()
        if (!config.enabled) {
          return next()
        }

        // Decrypt specified fields after finding
        const decryptDocs = (doc: any) => {
          for (const fieldName of fieldNames) {
            if (doc && doc[fieldName] !== undefined && doc[fieldName] !== null) {
              const value = String(doc[fieldName])
              if (isEncrypted(value)) {
                doc[fieldName] = decryptField(value, fieldName)
              }
            }
          }
        }

        if (Array.isArray(docs)) {
          docs.forEach(decryptDocs)
        } else if (docs) {
          decryptDocs(docs)
        }

        next()
      } catch (error) {
        next(error instanceof Error ? error : new Error(String(error)))
      }
    },
  }
}

/**
 * Generate a new master key for encryption
 * Run this to create a new key for MONGO_ENCRYPTION_KEY environment variable
 */
export function generateNewMasterKey(): string {
  const key = crypto.randomBytes(32)
  return key.toString('base64')
}
