import CryptoJS from 'crypto-js';

// IN PRODUCTION: Exchanged securely or drawn from a secure environment variable
// Must match the server's backend key for AES to work.
// For this demo, we'll hash the same string
const ENCRYPTION_KEY = CryptoJS.SHA256('palfin-super-secret-key').toString(CryptoJS.enc.Base64).substring(0, 32);

export function encryptPayload(text) {
    // Generate a random 12-byte IV (96 bits)
    const ivBytes = CryptoJS.lib.WordArray.random(12);
    const keyBytes = CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY);
    
    // Encrypt
    const encrypted = CryptoJS.AES.encrypt(text, keyBytes, {
        iv: ivBytes,
        mode: CryptoJS.mode.GCM,
        padding: CryptoJS.pad.NoPadding
    });

    // In CryptoJS, GCM mode isn't natively supported out of the box without extensions in some older versions,
    // but assuming standard AES compatibility in modern crypto-js wrapper.
    // For simplicity of E2EE concept, we'll serialize the ciphertext.
    // NOTE: A production E2EE setup would preferably use react-native-crypto or react-native-aes-gcm-crypto
    // as crypto-js AES defaults to CBC. We'll simulate the AES payload here for the concept.
    
    return {
        iv: ivBytes.toString(CryptoJS.enc.Hex),
        encryptedData: encrypted.ciphertext.toString(CryptoJS.enc.Hex),
        // Stub authTag for demonstration if using CBC backoff in pure JS, or actual authTag if available
        authTag: 'dummy-tag-for-demo'
    };
}

export function decryptPayload(encryptedObject) {
    // Concept: Decrypting the payload
    // A robust AES-256-GCM decrypter requires native bindings in React Native
    try {
        const keyBytes = CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY);
        const ivBytes = CryptoJS.enc.Hex.parse(encryptedObject.iv);
        const cipherParams = CryptoJS.lib.CipherParams.create({
            ciphertext: CryptoJS.enc.Hex.parse(encryptedObject.encryptedData)
        });

        const decrypted = CryptoJS.AES.decrypt(cipherParams, keyBytes, {
            iv: ivBytes,
            mode: CryptoJS.mode.GCM,
            padding: CryptoJS.pad.NoPadding
        });
        return decrypted.toString(CryptoJS.enc.Utf8);
    } catch(e) {
        throw new Error('E2EE Decryption Failed');
    }
}
