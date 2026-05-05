import CryptoJS from 'crypto-js';

// IN PRODUCTION: Exchanged securely or drawn from a secure environment variable
// Must match the server's backend key for AES to work.
// For this demo, we'll hash the same string
const ENCRYPTION_KEY = CryptoJS.SHA256('palfin-super-secret-key').toString(CryptoJS.enc.Base64).substring(0, 32);

export function encryptPayload(text) {
    // Generate a random 16-byte IV for CBC
    const ivBytes = CryptoJS.lib.WordArray.random(16);
    const keyBytes = CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY);
    
    // Encrypt using default (CBC + PKCS7)
    const encrypted = CryptoJS.AES.encrypt(text, keyBytes, {
        iv: ivBytes
    });

    return {
        iv: ivBytes.toString(CryptoJS.enc.Hex),
        encryptedData: encrypted.ciphertext.toString(CryptoJS.enc.Hex),
        authTag: 'none' // CBC doesn't have an authTag
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
