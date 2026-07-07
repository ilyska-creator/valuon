/**
 * Receipt Verification Module
 * Verifies Ed25519 signatures on fiscal receipts
 */

import Ed25519Signer from './crypto-signature.js';

class ReceiptVerifier {
    constructor() {
        this.signer = new Ed25519Signer();
    }

    /**
     * Verify a receipt's fiscal signature
     * @param {Object} receipt - Receipt object from database
     * @param {Object} shop - Shop object with public_key
     * @returns {Promise<{valid: boolean, error?: string}>}
     */
    async verifyReceipt(receipt, shop) {
        try {
            if (!receipt.fiscal_hash) {
                return { valid: false, error: 'No signature found' };
            }

            if (!shop || !shop.public_key) {
                return { valid: false, error: 'Shop public key not found' };
            }

            // Import shop's public key
            const publicKey = await this.signer.importPublicKey(shop.public_key);

            // Reconstruct the data that was signed
            const signData = `${shop.tax_id}|${receipt.item_name}|${receipt.net_total}|${receipt.vat_amount}|${receipt.purchase_date}`;

            // Verify the signature
            const isValid = await this.signer.verify(signData, receipt.fiscal_hash, publicKey);

            return { valid: isValid };
        } catch (error) {
            console.error('Receipt verification error:', error);
            return { valid: false, error: error.message };
        }
    }

    /**
     * Verify multiple receipts in batch
     * @param {Array} receipts - Array of receipt objects
     * @param {Object} shop - Shop object with public_key
     * @returns {Promise<Array<{receipt: Object, valid: boolean, error?: string}>>}
     */
    async verifyReceiptsBatch(receipts, shop) {
        const results = [];
        
        for (const receipt of receipts) {
            const result = await this.verifyReceipt(receipt, shop);
            results.push({ receipt, ...result });
        }

        return results;
    }

    /**
     * Check if Ed25519 is supported
     * @returns {boolean}
     */
    static isSupported() {
        return Ed25519Signer.isSupported();
    }
}

export default ReceiptVerifier;
