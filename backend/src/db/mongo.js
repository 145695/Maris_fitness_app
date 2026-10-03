const { MongoClient } = require("mongodb");
const config = require("../config");

const client = new MongoClient(config.mongo.uri, {
  serverSelectionTimeoutMS: 5000,
});

// Cache the connection PROMISE (not the db) so concurrent first calls share
// one connection attempt, and a failed attempt can be retried on the next call.
let connecting = null;

function getMongo() {
  if (!connecting) {
    connecting = client
      .connect()
      .then(() => client.db(config.mongo.dbName))
      .catch((err) => {
        connecting = null;
        throw err;
      });
  }
  return connecting;
}

async function closeMongo() {
  connecting = null;
  await client.close();
}

module.exports = { getMongo, closeMongo };
