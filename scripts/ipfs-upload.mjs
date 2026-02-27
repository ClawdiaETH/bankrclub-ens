#!/usr/bin/env node
/**
 * Upload a directory to Filebase via S3 + CAR.
 * 1. Pack the directory into a CAR with ipfs-car
 * 2. Upload the CAR to Filebase S3 (Content-Type: application/vnd.ipld.car)
 * 3. HEAD the object to read the CIDv0 (Qm...) from metadata
 *
 * Outputs the CIDv0 to stdout on success.
 */
import { S3Client, CreateBucketCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const ACCESS_KEY = process.env.FILEBASE_ACCESS_KEY;
const SECRET_KEY = process.env.FILEBASE_SECRET_KEY;
const DIR = process.argv[2] || 'out';
const NAME = process.argv[3] || 'bankrclub-ens';
const BUCKET = 'bankrclub-ens';
const KEY = `${NAME}-${Date.now()}.car`;

if (!ACCESS_KEY || !SECRET_KEY) {
  console.error('❌ FILEBASE_ACCESS_KEY and FILEBASE_SECRET_KEY required');
  process.exit(1);
}

const s3 = new S3Client({
  endpoint: 'https://s3.filebase.com',
  region: 'us-east-1',
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
});

const carPath = join(tmpdir(), `${NAME}.car`);

console.error(`📁 Packing ${DIR}/ into CAR...`);
execSync(`npx ipfs-car pack "${DIR}" --output "${carPath}"`, { stdio: ['pipe', 'pipe', 'inherit'] });

console.error('📤 Uploading to Filebase...');

// Ensure bucket exists
try {
  await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
} catch (e) {
  if (!['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes(e.Code ?? e.name)) {
    console.error('Bucket error:', e.Code ?? e.message);
    process.exit(1);
  }
}

// Upload CAR
const carData = readFileSync(carPath);
await s3.send(new PutObjectCommand({
  Bucket: BUCKET,
  Key: KEY,
  Body: carData,
  ContentType: 'application/vnd.ipld.car',
  Metadata: { name: NAME },
}));

// Poll for CID (Filebase pins async — usually instant)
let cid = null;
for (let i = 0; i < 10; i++) {
  const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: KEY }));
  cid = head.Metadata?.cid;
  if (cid) break;
  await new Promise(r => setTimeout(r, 1500));
}

if (!cid) {
  console.error('❌ Filebase did not return a CID after 15s');
  process.exit(1);
}

console.log(cid);
