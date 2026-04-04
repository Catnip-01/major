const crypto = require('crypto');

// AES-256-GCM configurations
const ALGORITHM = 'aes-256-gcm';
// In a real production app, this should be a 32-byte secure random string stored in .env
// For this demo, we'll hash a known string or expect one in ENV.
// Must be exactly 32 bytes for AES-256
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.createHash('sha256').update('palfin-super-secret-key').digest('base64').substring(0, 32);

// Initialization Vector length for GCM is typically 12 bytes
const IV_LENGTH = 12;

function encrypt(text) {
    // Generate a random IV
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'utf-8'), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get the auth tag (16 bytes)
    const authTag = cipher.getAuthTag();

    // Return the iv, encrypted data, and auth tag bundled together
    return {
        iv: iv.toString('hex'),
        encryptedData: encrypted,
        authTag: authTag.toString('hex')
    };
}

function decrypt(encryptedObject) {
    try {
        const iv = Buffer.from(encryptedObject.iv, 'hex');
        const authTag = Buffer.from(encryptedObject.authTag, 'hex');
        const encryptedText = Buffer.from(encryptedObject.encryptedData, 'hex');
        
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'utf-8'), iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        throw new Error('Decryption failed. Data may be tampered or key is invalid.');
    }
}

module.exports = {
    encrypt,
    decrypt
};
