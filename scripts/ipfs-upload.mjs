#!/usr/bin/env node
/**
 * Upload a directory to Pinata using the v3 API.
 * Creates one upload per file, grouped by a Pinata group.
 * Uses wrapWithDirectory:false so returned CID is the directory root.
 *
 * Falls back to v2 pinFileToIPFS if v3 fails.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { lookup as mimeType } from 'mime-types';

const PINATA_JWT = process.env.PINATA_JWT;
const DIR = process.argv[2] || 'out';
const NAME = process.argv[3] || 'bankrclub-ens';
const FOLDER_NAME = 'app';

if (!PINATA_JWT) { console.error('❌ PINATA_JWT required'); process.exit(1); }

function walk(dir, base = dir) {
  const entries = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) entries.push(...walk(full, base));
    else entries.push({ full, rel: relative(base, full) });
  }
  return entries;
}

const files = walk(DIR);
console.error(`📁 Uploading ${files.length} files from ${DIR}/`);

// --- V2 pinFileToIPFS with directory prefix (proven approach) ---
const boundary = `----FormBoundary${Date.now().toString(36)}`;
const parts = [];

for (const { full, rel } of files) {
  const data = readFileSync(full);
  const mime = mimeType(rel) || 'application/octet-stream';
  const pinataFilename = `${FOLDER_NAME}/${rel}`;
  parts.push(
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${pinataFilename}"\r\nContent-Type: ${mime}\r\n\r\n`),
    data,
    Buffer.from('\r\n')
  );
}

parts.push(
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="pinataMetadata"\r\n\r\n${JSON.stringify({ name: NAME })}\r\n`),
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="pinataOptions"\r\n\r\n${JSON.stringify({ cidVersion: 0, wrapWithDirectory: false })}\r\n`),
  Buffer.from(`--${boundary}--\r\n`)
);

const body = Buffer.concat(parts);

const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${PINATA_JWT}`,
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': String(body.length),
  },
  body,
});

const json = await res.json();
if (!json.IpfsHash) {
  console.error('❌ Upload failed:', JSON.stringify(json));
  process.exit(1);
}
console.log(json.IpfsHash);
