const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const mysql = require("mysql2/promise");

const port = process.env.PORT || 3000;
const webport = process.env.WEB_PORT || 8080;
const app = express();

const tableAllowlist = [
  "Person",
  "Rating",
  "Customer",
  "Retailer",
  "Bankaccount",
  "Vehicle",
  "Booking",
  "AdditionalService",
  "Bookings_Services",
];

const seedPath = path.join(__dirname, "seed", "generate_data.sql");

const dbConfig = {
  host: process.env.DB_HOST || "db",
  port: Number.parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "imse",
  password: process.env.DB_PASSWORD || "imse",
  database: process.env.DB_NAME || "imse",
  multipleStatements: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);

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

async function hasSeedData() {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS count FROM Person"
  );
  return rows[0].count > 0;
}

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/tables", (req, res) => {
  res.json({ tables: tableAllowlist });
});

app.get("/api/seed-status", async (req, res) => {
  try {
    const seeded = await hasSeedData();
    res.json({ seeded });
  } catch (err) {
    res.status(500).json({ error: "Failed to check seed status" });
  }
});

app.post("/api/generate", async (req, res) => {
  try {
    const seeded = await hasSeedData();
    if (seeded) {
      res.status(409).json({ error: "Data already generated" });
      return;
    }

    const seedSql = await fs.readFile(seedPath, "utf8");
    await pool.query(seedSql);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate data" });
  }
});

app.get("/api/table/:name", async (req, res) => {
  const table = req.params.name;
  if (!tableAllowlist.includes(table)) {
    res.status(400).json({ error: "Unknown table" });
    return;
  }

  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isNaN(requestedLimit)
    ? 50
    : Math.min(Math.max(requestedLimit, 1), 500);

  try {
    const [rows] = await pool.query(`SELECT * FROM \`${table}\` LIMIT ?`, [
      limit,
    ]);
    let columns = [];

    if (rows.length > 0) {
      columns = Object.keys(rows[0]);
    } else {
      const [info] = await pool.query(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [dbConfig.database, table]
      );
      columns = info.map((column) => column.COLUMN_NAME);
    }

    res.json({ table, columns, rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to load table data" });
  }
});

async function start() {
  try {
    await waitForDatabase();
    app.listen(port, () => {
      console.log(`UI running on http://localhost:${webport}`);
    });
  } catch (err) {
    console.error("Failed to start server", err);
    process.exit(1);
  }
}

start();
