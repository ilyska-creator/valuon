class Ed25519Signer {
    constructor() {
        this.keyPair = null;
        this.publicKey = null;
        this.privateKey = null;
    }

    
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

    
    async exportPublicKey(publicKey = this.publicKey) {
        if (!publicKey) throw new Error('No public key available');

        const exported = await window.crypto.subtle.exportKey('spki', publicKey);
        const exportedAsBase64 = this.arrayBufferToBase64(exported);
        return exportedAsBase64;
    }

    
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

    
    async exportPrivateKey(privateKey = this.privateKey) {
        if (!privateKey) throw new Error('No private key available');

        const exported = await window.crypto.subtle.exportKey('pkcs8', privateKey);
        const exportedAsBase64 = this.arrayBufferToBase64(exported);
        return exportedAsBase64;
    }

    
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

    
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    
    base64ToArrayBuffer(base64) {
        const binaryString = window.atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    
    static isSupported() {
        return 'crypto' in window &&
            'subtle' in window.crypto &&
            typeof window.crypto.subtle.generateKey === 'function';
    }
}

export default Ed25519Signer;
