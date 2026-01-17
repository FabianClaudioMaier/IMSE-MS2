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
  dateStrings: true,
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

async function hasSeedData() {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS count FROM Person"
  );
  return rows[0].count > 0;
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

function buildInClause(values) {
  return values.map(() => "?").join(", ");
}

app.use(express.json());
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

app.get("/api/usecase/customers", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         p.id AS person_id,
         p.name,
         p.eMail,
         p.phone_number,
         p.address,
         c.customer_number,
         c.driver_licencse_number,
         b.account_id,
         b.iban,
         b.bic
       FROM Customer c
       JOIN Person p ON p.id = c.person_id
       JOIN Bankaccount b ON b.person_id = c.person_id
       ORDER BY p.name`
    );
    res.json({ customers: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to load customers" });
  }
});

app.get("/api/usecase/bookings", async (req, res) => {
  const customerId = req.query.customerId;
  if (!customerId) {
    res.status(400).json({ error: "Missing customerId" });
    return;
  }

  try {
    const [rows] = await pool.query(
      `SELECT
         b.booking_id,
         b.start_date,
         b.end_date,
         b.way_of_billing,
         b.vehicle_id,
         b.total_costs,
         v.model,
         v.producer,
         v.costs_per_day,
         v.plate_number,
         v.number_of_seats,
         GREATEST(DATEDIFF(b.end_date, b.start_date), 1) AS days,
         GREATEST(DATEDIFF(b.end_date, b.start_date), 1) * v.costs_per_day AS base_cost,
         COALESCE(SUM(a.costs), 0) AS extras_cost
       FROM Booking b
       JOIN Vehicle v ON v.vehicle_id = b.vehicle_id
       LEFT JOIN Bookings_Services bs ON bs.booking_id = b.booking_id
       LEFT JOIN AdditionalService a ON a.additional_service_id = bs.additional_service_id
       WHERE b.customer_id = ? AND b.start_date >= CURDATE()
       GROUP BY
         b.booking_id,
         b.start_date,
         b.end_date,
         b.way_of_billing,
         b.vehicle_id,
         b.total_costs,
         v.model,
         v.producer,
         v.costs_per_day,
         v.plate_number,
         v.number_of_seats
       ORDER BY b.start_date, b.booking_id`,
      [customerId]
    );

    const bookings = rows.map((row) => {
      const baseCost = Number(row.base_cost) || 0;
      const extrasCost = Number(row.extras_cost) || 0;
      return {
        ...row,
        base_cost: baseCost,
        extras_cost: extrasCost,
        total_cost: baseCost + extrasCost,
      };
    });

    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ error: "Failed to load bookings" });
  }
});

app.get("/api/usecase/bookings/:id/services", async (req, res) => {
  const bookingId = req.params.id;

  try {
    const [available] = await pool.query(
      `SELECT
         a.additional_service_id,
         a.description,
         a.costs
       FROM AdditionalService a
       LEFT JOIN Bookings_Services bs
         ON bs.additional_service_id = a.additional_service_id
        AND bs.booking_id = ?
       WHERE bs.booking_id IS NULL
       ORDER BY a.description`,
      [bookingId]
    );

    const [current] = await pool.query(
      `SELECT
         a.additional_service_id,
         a.description,
         a.costs
       FROM AdditionalService a
       JOIN Bookings_Services bs
         ON bs.additional_service_id = a.additional_service_id
       WHERE bs.booking_id = ?
       ORDER BY a.description`,
      [bookingId]
    );

    res.json({ available, current });
  } catch (err) {
    res.status(500).json({ error: "Failed to load services" });
  }
});

app.post("/api/usecase/bookings/:id/services", async (req, res) => {
  const bookingId = req.params.id;
  const { customerId, serviceIds, confirmPayment } = req.body || {};

  if (!customerId) {
    res.status(400).json({ error: "Missing customerId" });
    return;
  }

  if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
    res.status(400).json({ error: "No additional services selected" });
    return;
  }

  if (!confirmPayment) {
    res.status(400).json({ error: "Payment not confirmed" });
    return;
  }

  const uniqueServiceIds = [...new Set(serviceIds)];

  try {
    const [bookingRows] = await pool.query(
      `SELECT booking_id
       FROM Booking
       WHERE booking_id = ? AND customer_id = ? AND start_date >= CURDATE()`,
      [bookingId, customerId]
    );

    if (bookingRows.length === 0) {
      res.status(404).json({ error: "Booking not found or inactive" });
      return;
    }

    const [bankRows] = await pool.query(
      "SELECT 1 FROM Bankaccount WHERE person_id = ?",
      [customerId]
    );

    if (bankRows.length === 0) {
      res.status(400).json({ error: "Customer has no bank account" });
      return;
    }

    const serviceClause = buildInClause(uniqueServiceIds);
    const [serviceRows] = await pool.query(
      `SELECT additional_service_id
       FROM AdditionalService
       WHERE additional_service_id IN (${serviceClause})`,
      uniqueServiceIds
    );

    if (serviceRows.length !== uniqueServiceIds.length) {
      res.status(400).json({ error: "Invalid additional service selection" });
      return;
    }

    const values = uniqueServiceIds.map(() => "(?, ?)").join(", ");
    const params = uniqueServiceIds.flatMap((id) => [bookingId, id]);
    await pool.query(
      `INSERT IGNORE INTO Bookings_Services (booking_id, additional_service_id)
       VALUES ${values}`,
      params
    );

    const [totalsRows] = await pool.query(
      `SELECT
         GREATEST(DATEDIFF(b.end_date, b.start_date), 1) * v.costs_per_day AS base_cost,
         COALESCE(SUM(a.costs), 0) AS extras_cost
       FROM Booking b
       JOIN Vehicle v ON v.vehicle_id = b.vehicle_id
       LEFT JOIN Bookings_Services bs ON bs.booking_id = b.booking_id
       LEFT JOIN AdditionalService a ON a.additional_service_id = bs.additional_service_id
       WHERE b.booking_id = ?
       GROUP BY b.booking_id, v.costs_per_day, b.start_date, b.end_date`,
      [bookingId]
    );

    const totals = totalsRows[0] || { base_cost: 0, extras_cost: 0 };
    const totalCost =
      (Number(totals.base_cost) || 0) + (Number(totals.extras_cost) || 0);

    await pool.query(
      "UPDATE Booking SET total_costs = ? WHERE booking_id = ?",
      [totalCost, bookingId]
    );

    res.json({
      ok: true,
      base_cost: Number(totals.base_cost) || 0,
      extras_cost: Number(totals.extras_cost) || 0,
      total_cost: totalCost,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to add additional services" });
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
    await waitForSchema();
    await ensureBookingTotalCostsColumn();
    app.listen(port, () => {
      console.log(`UI running on http://localhost:${webport}`);
    });
  } catch (err) {
    console.error("Failed to start server", err);
    process.exit(1);
  }
}

start();
