const mysql = require("mysql2/promise");
const { MongoClient } = require("mongodb");

const dbConfig = {
  host: process.env.DB_HOST || "db",
  port: Number.parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "imse",
  password: process.env.DB_PASSWORD || "imse",
  database: process.env.DB_NAME || "imse",
  multipleStatements: true,
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const mongoUrl = process.env.MONGO_URL || "mongodb://mongo:27017";
const mongoDbName = process.env.MONGO_DB || "imse_nosql";

const pool = mysql.createPool(dbConfig);

const defaultDbMode = process.env.DB_MODE === "nosql" ? "nosql" : "sql";
let dbMode = defaultDbMode;

let mongoClient = null;
let mongoDb = null;

function isNoSqlMode() {
  return dbMode === "nosql";
}

function setDbMode(mode) {
  dbMode = mode === "nosql" ? "nosql" : "sql";
}

async function getMongoDb() {
  if (mongoDb) {
    return mongoDb;
  }
  mongoClient = new MongoClient(mongoUrl);
  await mongoClient.connect();
  mongoDb = mongoClient.db(mongoDbName);
  return mongoDb;
}

function toUtcMs(dateStr) {
  if (!dateStr || typeof dateStr !== "string") {
    return null;
  }
  const parts = dateStr.split("-");
  if (parts.length !== 3) {
    return null;
  }
  const year = Number.parseInt(parts[0], 10);
  const month = Number.parseInt(parts[1], 10);
  const day = Number.parseInt(parts[2], 10);
  if (!year || !month || !day) {
    return null;
  }
  return Date.UTC(year, month - 1, day);
}

function calcRentalDays(startDate, endDate) {
  const startMs = toUtcMs(startDate);
  const endMs = toUtcMs(endDate);
  if (startMs === null || endMs === null) {
    return 1;
  }
  const diffDays = Math.round((endMs - startMs) / 86400000);
  return Math.max(diffDays, 1);
}

function asNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

async function waitForDatabase() {
  const maxAttempts = 25;
  const delayMs = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (err) {
      if (attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function waitForSchema() {
  const maxAttempts = 25;
  const delayMs = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const [rows] = await pool.query(
        `SELECT COUNT(*) AS count
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'Booking'`,
        [dbConfig.database]
      );
      if (rows[0].count > 0) {
        return;
      }
    } catch (err) {
      if (attempt === maxAttempts) {
        throw err;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error("Database schema not ready");
}

async function ensureBookingTotalCostsColumn() {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'Booking' AND COLUMN_NAME = 'total_costs'`,
    [dbConfig.database]
  );

  if (rows[0].count === 0) {
    await pool.query(
      "ALTER TABLE Booking ADD COLUMN total_costs DECIMAL(10,2)"
    );
  }
}

module.exports = {
  dbConfig,
  pool,
  getMongoDb,
  isNoSqlMode,
  setDbMode,
  calcRentalDays,
  asNumber,
  waitForDatabase,
  waitForSchema,
  ensureBookingTotalCostsColumn,
};
