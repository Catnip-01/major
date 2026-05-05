import CryptoJS from 'crypto-js';

// IN PRODUCTION: Exchanged securely or drawn from a secure environment variable
// Must match the server's backend key for AES to work.
// For this demo, we'll hash the same string
const KEY_SECRET = 'palfin-super-secret-key';

export function encryptPayload(text) {
    // Generate a random 16-byte IV
    const ivBytes = CryptoJS.lib.WordArray.random(16);
    // Use raw SHA256 hash of the secret as the key
    const keyBytes = CryptoJS.SHA256(KEY_SECRET);
    
    const encrypted = CryptoJS.AES.encrypt(text, keyBytes, {
        iv: ivBytes
    });

    return {
        iv: ivBytes.toString(CryptoJS.enc.Hex),
        encryptedData: encrypted.ciphertext.toString(CryptoJS.enc.Hex),
        authTag: 'none'
    };
}

export function decryptPayload(encryptedObject) {
    // Concept: Decrypting the payload
    // A robust AES-256-GCM decrypter requires native bindings in React Native
    try {
        const keyBytes = CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY);
        const ivBytes = CryptoJS.enc.Hex.parse(encryptedObject.iv);

        const decrypted = CryptoJS.AES.decrypt(
            { ciphertext: CryptoJS.enc.Hex.parse(encryptedObject.encryptedData) },
            keyBytes,
            { iv: ivBytes }
        );
        return decrypted.toString(CryptoJS.enc.Utf8);
    } catch(e) {
        throw new Error('E2EE Decryption Failed');
    }
}
