/**
 * Labs Burger Security Utility Script
 * 
 * USE THIS TO: 
 * 1. Generate a strong JWT_SECRET
 * 2. Generate bcrypt hashes for your User PINs
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';

const generateSecret = () => {
    return crypto.randomBytes(32).toString('hex');
};

const hashPin = async (pin) => {
    if (!pin || pin.length < 4) {
        console.error('❌ Error: PIN must be at least 4 digits.');
        return;
    }
    const hash = await bcrypt.hash(String(pin), 10);
    return hash;
};

const run = async () => {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command) {
        console.log(`
🏠 Labs Burger Security Utility
-------------------------------
Usage:
  node security-util.js secret          - Generates a 32-byte hex secret
  node security-util.js hash <PIN>     - Generates a bcrypt hash for a PIN
        `);
        return;
    }

    if (command === 'secret') {
        const secret = generateSecret();
        console.log('\n🔒 SECURE JWT_SECRET GENERATED:');
        console.log('---------------------------------');
        console.log(secret);
        console.log('---------------------------------');
        console.log('👉 Add this to your backend .env or docker-compose.prod.yml\n');
    } else if (command === 'hash') {
        const pin = args[1];
        if (!pin) {
            console.error('❌ Error: Please provide a PIN to hash. Example: node security-util.js hash 1234');
            return;
        }
        const hash = await hashPin(pin);
        if (hash) {
            console.log(`\n🔑 BCRYPT HASH FOR PIN "${pin}":`);
            console.log('---------------------------------');
            console.log(hash);
            console.log('---------------------------------');
            console.log('👉 Use this to update the "pin_hash" in your PostgreSQL database:\n');
            console.log(`   UPDATE users SET pin_hash = '${hash}' WHERE name = 'Owner';\n`);
        }
    } else {
        console.log('❌ Unknown command. Use "secret" or "hash".');
    }
};

run().catch(err => console.error(err));
