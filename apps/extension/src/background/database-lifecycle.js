export async function withDatabase({ openDatabase, work }) {
  const database = await openDatabase();
  try {
    return await work(database);
  } finally {
    database.close();
  }
}
