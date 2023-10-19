const { Pool } = require("pg");
require("dotenv").config();

const dbConnect = () =>
  new Pool({
    user: process.env.PG_USERNAME,
    host: process.env.PG_ENDPOINT,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT, // Default PostgreSQL port is 5432
    max: 20,    // Maximum number of connections in the pool
    idleTimeoutMillis: 30000,
  });

module.exports = dbConnect;
