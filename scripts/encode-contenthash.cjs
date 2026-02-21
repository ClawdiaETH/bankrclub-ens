#!/usr/bin/env node
const contentHash = require('@ensdomains/content-hash');

const cid = process.argv[2];
if (!cid) {
  console.error('Usage: encode-contenthash.cjs <cid>');
  process.exit(1);
}

const encoded = contentHash.encode('ipfs', cid);
console.log('0x' + encoded);
