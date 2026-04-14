import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer;

/** Spin up an in-memory MongoDB and connect Mongoose to it */
export async function connectTestDB() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
}

/** Drop all collections between tests for a clean slate */
export async function clearTestDB() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const col = collections[key];
    if (col) await col.deleteMany({});
  }
}

/** Disconnect and stop the in-memory server */
export async function closeTestDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
}
