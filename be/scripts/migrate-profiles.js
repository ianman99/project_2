// be/data/*.json 프로필을 MongoDB 'students' 컬렉션으로 적재한다.
// _id(학번 문자열) 기준 upsert라 여러 번 실행해도 안전하다.
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { MongoClient } = require('mongodb');

const DATA_DIR = path.join(__dirname, '..', 'data');
const { MONGODB_URI, MONGODB_DB } = process.env;

if (!MONGODB_URI) {
  console.error('MONGODB_URI가 .env에 없습니다.');
  process.exit(1);
}

function loadProfiles() {
  return fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'class_index.json')
    .map((f) => {
      const doc = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
      if (!doc._id) throw new Error(`${f}: _id 없음`);
      return doc;
    });
}

async function main() {
  const profiles = loadProfiles();
  console.log(`읽은 프로필: ${profiles.length}건`);

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  try {
    const students = client.db(MONGODB_DB).collection('students');
    const result = await students.bulkWrite(
      profiles.map((doc) => ({
        replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
      })),
    );
    console.log(`upsert: ${result.upsertedCount}건, 갱신: ${result.modifiedCount}건`);

    await students.createIndex({ 'profile.gender': 1 });
    await students.createIndex({ name: 1 });
    console.log(`컬렉션 문서 수: ${await students.countDocuments()}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
