import { MongoClient, type Db, type Collection, type Document } from 'mongodb';
import { config } from './config';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDb(): Promise<Db> {
  if (db) return db;

  client = new MongoClient(config.mongo.uri);
  await client.connect();
  db = client.db(config.mongo.db);
  return db;
}

export function getDb(): Db {
  if (!db) {
    throw new Error('DB가 아직 연결되지 않았습니다. connectDb()를 먼저 호출하세요.');
  }
  return db;
}

export function getCollection<T extends Document>(name: string): Collection<T> {
  return getDb().collection<T>(name);
}

export async function closeDb(): Promise<void> {
  await client?.close();
  client = null;
  db = null;
}

/** 헬스체크용 핑. 실패하면 예외를 던진다. */
export async function pingDb(): Promise<void> {
  await getDb().command({ ping: 1 });
}
