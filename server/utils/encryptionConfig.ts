/**
 * MongoDB Encryption at Rest Configuration (§5.3, §10.2)
 * 
 * Manages master encryption keys and encryption configuration for AES-256 encryption.
 * 
 * KEY MANAGEMENT STRATEGY:
 * - Master key stored in environment variable (MONGO_ENCRYPTION_KEY)
 * - In production, should use a KMS (Key Management Service) like AWS KMS, Azure Key Vault, or HashiCorp Vault
 * - Master key must be 32 bytes for AES-256
 * - Keys should be rotated periodically
 * 
 * ENVIRONMENT SETUP:
 * Set in .env or your deployment platform:
 *   MONGO_ENCRYPTION_KEY=<base64-encoded-32-byte-key>
 * 
 * To generate a new key:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */

import crypto from 'crypto'

export interface EncryptionConfig {
  enabled: boolean
  masterKeyBuffer: Buffer
  algorithm: string
  keyDerivationSalt: Buffer
}

class EncryptionConfigManager {
  private config: EncryptionConfig | null = null

  /**
   * Initialize encryption configuration
   * Call this during app startup to validate the master key
   */
  public initialize(): EncryptionConfig {
    if (this.config) {
      return this.config
    }

    const enabled = process.env.MONGO_ENCRYPTION_ENABLED === 'true'

    if (!enabled) {
      this.config = {
        enabled: false,
        masterKeyBuffer: Buffer.alloc(0),
        algorithm: 'aes-256-gcm',
        keyDerivationSalt: Buffer.alloc(0),
      }
      return this.config
    }

    // If encryption is enabled, master key is required
    const masterKeyEnv = process.env.MONGO_ENCRYPTION_KEY?.trim()
    if (!masterKeyEnv) {
      throw new Error(
        'MONGO_ENCRYPTION_ENABLED=true but MONGO_ENCRYPTION_KEY environment variable not set'
      )
    }

    let masterKeyBuffer: Buffer
    try {
      masterKeyBuffer = Buffer.from(masterKeyEnv, 'base64')
    } catch {
      throw new Error('MONGO_ENCRYPTION_KEY must be base64-encoded')
    }

    if (masterKeyBuffer.length !== 32) {
      throw new Error(
        `MONGO_ENCRYPTION_KEY must be exactly 32 bytes (256 bits). Got ${masterKeyBuffer.length} bytes. ` +
          'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
      )
    }

    // Derive a salt for PBKDF2 key derivation (constant across app lifetime)
    const derivationSalt = crypto.createHash('sha256').update('COS417-MONGO-ENCRYPTION').digest()

    this.config = {
      enabled: true,
      masterKeyBuffer,
      algorithm: 'aes-256-gcm',
      keyDerivationSalt: derivationSalt,
    }

    return this.config
  }

  /**
   * Get current encryption configuration
   * Must call initialize() first
   */
  public getConfig(): EncryptionConfig {
    if (!this.config) {
      throw new Error('EncryptionConfigManager not initialized. Call initialize() first.')
    }
    return this.config
  }

  /**
   * Check if encryption is enabled
   */
  public isEnabled(): boolean {
    if (!this.config) {
      return process.env.MONGO_ENCRYPTION_ENABLED === 'true'
    }
    return this.config.enabled
  }

  /**
   * Rotate the master key (future implementation)
   * In production, this would be called as part of a scheduled key rotation policy
   */
  public rotateKey(newMasterKeyBase64: string): void {
    if (!this.config?.enabled) {
      throw new Error('Encryption is not enabled. Cannot rotate key.')
    }

    const newKeyBuffer = Buffer.from(newMasterKeyBase64, 'base64')
    if (newKeyBuffer.length !== 32) {
      throw new Error(
        `New master key must be exactly 32 bytes. Got ${newKeyBuffer.length} bytes.`
      )
    }

    // In a real implementation, this would:
    // 1. Create a new DEK with the new master key
    // 2. Re-encrypt all data with the new DEK
    // 3. Update the encrypted DEK in the database
    // 4. Update this.config

    throw new Error('Key rotation not yet implemented')
  }
}

export const encryptionConfigManager = new EncryptionConfigManager()
