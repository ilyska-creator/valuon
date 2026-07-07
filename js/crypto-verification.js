

import Ed25519Signer from './crypto-signature.js';

class ReceiptVerifier {
    constructor() {
        this.signer = new Ed25519Signer();
    }

    
    async verifyReceipt(receipt, shop) {
        try {
            if (!receipt.fiscal_hash) {
                return { valid: false, error: 'No signature found' };
            }

            if (!shop || !shop.public_key) {
                return { valid: false, error: 'Shop public key not found' };
            }

            
            const publicKey = await this.signer.importPublicKey(shop.public_key);

            
            const signData = `${shop.tax_id}|${receipt.item_name}|${receipt.net_total}|${receipt.vat_amount}|${receipt.purchase_date}`;

            
            const isValid = await this.signer.verify(signData, receipt.fiscal_hash, publicKey);

            return { valid: isValid };
        } catch (error) {
            console.error('Receipt verification error:', error);
            return { valid: false, error: error.message };
        }
    }

    
    async verifyReceiptsBatch(receipts, shop) {
        const results = [];
        
        for (const receipt of receipts) {
            const result = await this.verifyReceipt(receipt, shop);
            results.push({ receipt, ...result });
        }

        return results;
    }

    
    static isSupported() {
        return Ed25519Signer.isSupported();
    }
}

export default ReceiptVerifier;
