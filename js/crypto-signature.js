class Ed25519Signer {
    constructor() {
        this.keyPair = null;
        this.publicKey = null;
        this.privateKey = null;
    }

    /**
     * Generate a new Ed25519 key pair
     * @returns {Promise<CryptoKeyPair>}
     */
    async generateKeyPair() {
        try {
            const keyPair = await window.crypto.subtle.generateKey(
                {
                    name: 'Ed25519',
                    namedCurve: 'Ed25519'
                },
                true,
                ['sign', 'verify']
            );

            this.keyPair = keyPair;
            this.publicKey = keyPair.publicKey;
            this.privateKey = keyPair.privateKey;

            return keyPair;
        } catch (error) {
            console.error('Failed to generate Ed25519 key pair:', error);
            throw new Error('Ed25519 is not supported in this browser. Please use Chrome 137+, Firefox 129+, or Safari 17+');
        }
    }

    /**
     * Export public key to base64 string for storage
     * @param {CryptoKey} publicKey
     * @returns {Promise<string>}
     */
    async exportPublicKey(publicKey = this.publicKey) {
        if (!publicKey) throw new Error('No public key available');

        const exported = await window.crypto.subtle.exportKey('spki', publicKey);
        const exportedAsBase64 = this.arrayBufferToBase64(exported);
        return exportedAsBase64;
    }

    /**
     * Import public key from base64 string
     * @param {string} base64Key
     * @returns {Promise<CryptoKey>}
     */
    async importPublicKey(base64Key) {
        const binaryString = this.base64ToArrayBuffer(base64Key);
        return await window.crypto.subtle.importKey(
            'spki',
            binaryString,
            {
                name: 'Ed25519',
                namedCurve: 'Ed25519'
            },
            true,
            ['verify']
        );
    }

    /**
     * Export private key to base64 string for storage (use with caution!)
     * @param {CryptoKey} privateKey
     * @returns {Promise<string>}
     */
    async exportPrivateKey(privateKey = this.privateKey) {
        if (!privateKey) throw new Error('No private key available');

        const exported = await window.crypto.subtle.exportKey('pkcs8', privateKey);
        const exportedAsBase64 = this.arrayBufferToBase64(exported);
        return exportedAsBase64;
    }

    /**
     * Import private key from base64 string
     * @param {string} base64Key
     * @returns {Promise<CryptoKey>}
     */
    async importPrivateKey(base64Key) {
        const binaryString = this.base64ToArrayBuffer(base64Key);
        return await window.crypto.subtle.importKey(
            'pkcs8',
            binaryString,
            {
                name: 'Ed25519',
                namedCurve: 'Ed25519'
            },
            true,
            ['sign']
        );
    }

    /**
     * Sign data with the private key
     * @param {string} data - Data to sign
     * @param {CryptoKey} privateKey
     * @returns {Promise<string>} Base64 encoded signature
     */
    async sign(data, privateKey = this.privateKey) {
        if (!privateKey) throw new Error('No private key available for signing');

        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);

        const signature = await window.crypto.subtle.sign(
            'Ed25519',
            privateKey,
            dataBuffer
        );

        return this.arrayBufferToBase64(signature);
    }

    /**
     * Verify signature with public key
     * @param {string} data - Original data
     * @param {string} signatureBase64 - Base64 encoded signature
     * @param {CryptoKey} publicKey
     * @returns {Promise<boolean>}
     */
    async verify(data, signatureBase64, publicKey = this.publicKey) {
        if (!publicKey) throw new Error('No public key available for verification');

        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const signatureBuffer = this.base64ToArrayBuffer(signatureBase64);

        const isValid = await window.crypto.subtle.verify(
            'Ed25519',
            publicKey,
            signatureBuffer,
            dataBuffer
        );

        return isValid;
    }

    /**
     * Convert ArrayBuffer to Base64 string
     * @param {ArrayBuffer} buffer
     * @returns {string}
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    /**
     * Convert Base64 string to ArrayBuffer
     * @param {string} base64
     * @returns {ArrayBuffer}
     */
    base64ToArrayBuffer(base64) {
        const binaryString = window.atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Check if Ed25519 is supported in current browser
     * @returns {boolean}
     */
    static isSupported() {
        return 'crypto' in window &&
            'subtle' in window.crypto &&
            typeof window.crypto.subtle.generateKey === 'function';
    }
}

export default Ed25519Signer;
