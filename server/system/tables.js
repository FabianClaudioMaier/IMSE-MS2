const express = require("express");
const { pool, dbConfig } = require("./db");

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

const router = express.Router();

router.get("/tables", (req, res) => {
  res.json({ tables: tableAllowlist });
});

router.get("/table/:name", async (req, res) => {
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

module.exports = { router };
