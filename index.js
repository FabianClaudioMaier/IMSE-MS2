const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const mysql = require("mysql2/promise");
const {MongoClient}= require("mongodb");

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


const mongoUrl = process.env.MONGO_URL || "mongodb://mongo:27017";
const mongoDbName = process.env.MONGO_DB || "imse_nosql";


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

//Mongo DB migration

async function migrateToMongo() {
  const client = new MongoClient(mongoUrl);
  await client.connect();
  const db = client.db(mongoDbName);

  // 1) Clear collections
  await Promise.all([
    db.collection("persons").deleteMany({}),
    db.collection("vehicles").deleteMany({}),
    db.collection("services").deleteMany({}),
    db.collection("bookings").deleteMany({}),
    db.collection("ratings").deleteMany({}),
  ]);

  // 2) Load base tables
  const [persons] = await pool.query(`
    SELECT p.*, c.customer_number, c.driver_licencse_number,
           r.company_name, r.tax_number,
           b.account_id, b.iban, b.bic
    FROM Person p
    LEFT JOIN Customer c ON c.person_id = p.id
    LEFT JOIN Retailer r ON r.person_id = p.id
    LEFT JOIN Bankaccount b ON b.person_id = p.id
  `);

  const [vehicles] = await pool.query(`SELECT * FROM Vehicle`);
  const [services] = await pool.query(`SELECT * FROM AdditionalService`);
  const [ratings] = await pool.query(`SELECT * FROM Rating`);

  // 3) Write base collections
  if (persons.length) await db.collection("persons").insertMany(persons.map(p => ({
    _id: p.id,
    name: p.name,
    phone_number: p.phone_number,
    eMail: p.eMail,
    address: p.address,
    stars: p.stars,
    roles: {
      customer: p.customer_number ? {
        customer_number: p.customer_number,
        driver_licencse_number: p.driver_licencse_number,
      } : null,
      retailer: p.company_name ? {
        company_name: p.company_name,
        tax_number: p.tax_number,
      } : null,
    },
    bankAccount: p.account_id ? {
      account_id: p.account_id,
      iban: p.iban,
      bic: p.bic,
    } : null,
  })));

  if (vehicles.length) await db.collection("vehicles").insertMany(vehicles.map(v => ({
    _id: v.vehicle_id,
    model: v.model,
    producer: v.producer,
    costs_per_day: v.costs_per_day,
    plate_number: v.plate_number,
    number_of_seats: v.number_of_seats,
    retailer_id: v.retailer_id,
  })));

  if (services.length) await db.collection("services").insertMany(services.map(s => ({
    _id: s.additional_service_id,
    description: s.description,
    costs: s.costs,
  })));

  if (ratings.length) await db.collection("ratings").insertMany(ratings.map(r => ({
    _id: { rater_id: r.rater_id, rated_id: r.rated_id },
    stars: r.stars,
  })));

  // 4) Build bookings aggregate
  const [bookings] = await pool.query(`
    SELECT b.booking_id, b.start_date, b.end_date, b.total_costs, b.way_of_billing,
           c.person_id AS customer_id, p.name AS customer_name,
           v.vehicle_id, v.model, v.producer, v.costs_per_day,
           r.person_id AS retailer_id, r.company_name,
           s.additional_service_id, s.description, s.costs
    FROM Booking b
    JOIN Customer c ON c.person_id = b.customer_id
    JOIN Person p ON p.id = c.person_id
    JOIN Vehicle v ON v.vehicle_id = b.vehicle_id
    JOIN Retailer r ON r.person_id = v.retailer_id
    LEFT JOIN Bookings_Services bs ON bs.booking_id = b.booking_id
    LEFT JOIN AdditionalService s ON s.additional_service_id = bs.additional_service_id
    ORDER BY b.booking_id
  `);

  const grouped = new Map();
  for (const row of bookings) {
    if (!grouped.has(row.booking_id)) {
      grouped.set(row.booking_id, {
        _id: row.booking_id,
        start_date: row.start_date,
        end_date: row.end_date,
        way_of_billing: row.way_of_billing,
        customer: { person_id: row.customer_id, name: row.customer_name },
        vehicle: {
          vehicle_id: row.vehicle_id,
          model: row.model,
          producer: row.producer,
          costs_per_day: row.costs_per_day,
        },
        retailer: {
          person_id: row.retailer_id,
          company_name: row.company_name,
        },
        additionalServices: [],
        pricing: { total_costs: row.total_costs },
      });
    }
    if (row.additional_service_id) {
      grouped.get(row.booking_id).additionalServices.push({
        service_id: row.additional_service_id,
        description: row.description,
        costs: row.costs,
      });
    }
  }

  const bookingDocs = Array.from(grouped.values());
  if (bookingDocs.length) {
    await db.collection("bookings").insertMany(bookingDocs);
  }

  await client.close();
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






app.get("/api/usecase2/report", async (req, res) => {
  try {
    const { from, to, customerId, retailerId } = req.query;
    const filters = [];
    const params = [];

    if (from) {
      filters.push("b.start_date >= ?");
      params.push(from);
    }

    if (to) {
      filters.push("b.start_date < ?");
      params.push(to);
    }

    if (customerId) {
      filters.push("c.person_id = ?");
      params.push(customerId);
    }

    if (retailerId) {
      filters.push("r.person_id = ?");
      params.push(retailerId);
    }

    const whereSql = filters.length ? " WHERE " + filters.join(" AND ") : "";

    const sql =
      "SELECT " +
      "b.booking_id, " +
      "b.start_date, " +
      "b.end_date, " +
      "c.person_id AS customer_id, " +
      "pc.name AS customer_name, " +
      "ba.iban AS customer_iban, " +
      "ba.bic AS customer_bic, " +
      "v.vehicle_id, " +
      "v.model, " +
      "v.producer, " +
      "r.person_id AS retailer_id, " +
      "r.company_name AS retailer_name, " +
      "GREATEST(DATEDIFF(b.end_date, b.start_date), 1) AS rental_days, " +
      "v.costs_per_day AS cost_per_day, " +
      "GREATEST(DATEDIFF(b.end_date, b.start_date), 1) * v.costs_per_day AS base_cost, " +
      "COALESCE(SUM(asv.costs), 0) AS additional_costs, " +
      "COUNT(bs.additional_service_id) AS additional_services_count, " +
      "(GREATEST(DATEDIFF(b.end_date, b.start_date), 1) * v.costs_per_day) " +
      "+ COALESCE(SUM(asv.costs), 0) AS total_cost, " +
      "GROUP_CONCAT(asv.description ORDER BY asv.description SEPARATOR ', ') AS additional_services_list " +
      "FROM Booking b " +
      "JOIN Customer c ON c.person_id = b.customer_id " +
      "JOIN Person pc ON pc.id = c.person_id " +
      "JOIN Bankaccount ba ON ba.person_id = c.person_id " +
      "JOIN Vehicle v ON v.vehicle_id = b.vehicle_id " +
      "JOIN Retailer r ON r.person_id = v.retailer_id " +
      "JOIN Bookings_Services bs ON bs.booking_id = b.booking_id " +
      "JOIN AdditionalService asv ON asv.additional_service_id = bs.additional_service_id " +
      whereSql +
      "GROUP BY " +
      "b.booking_id, b.start_date, b.end_date, " +
      "c.person_id, pc.name, " +
      "ba.iban, ba.bic, " +
      "v.vehicle_id, v.model, v.producer, " +
      "r.person_id, r.company_name, " +
      "v.costs_per_day " +
      "ORDER BY b.start_date DESC";

    const [rows] = await pool.query(sql, params);
    res.json({ report: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});


//Da beginnt use case 1


app.get("/api/usecase1/customers", async (req, res) => {
  try {
    const [result] = await pool.query(
      `SELECT p.id AS person_id, p.name, c.customer_number, c.driver_licencse_number, b.iban
       FROM Customer c
       JOIN Person p ON p.id = c.person_id
       JOIN Bankaccount b ON b.person_id = c.person_id
       ORDER BY p.name`
    );
    res.json({ customers: result });
  } catch (err) {
    res.status(500).json({error: "No chance to get customer data" });
  }
});




app.get("/api/usecase1/vehicles", async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: "Missing dates" });

  try {
    const [rows] = await pool.query(
      `SELECT v.vehicle_id, v.model, v.producer, v.costs_per_day, v.plate_number
       FROM Vehicle v
       LEFT JOIN Booking b
         ON v.vehicle_id = b.vehicle_id
        AND b.start_date <= ? AND b.end_date >= ?
       WHERE b.booking_id IS NULL
       ORDER BY v.producer, v.model`,
      [end, start]
    );
    res.json({ vehicles: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to load vehicles" });
  }
});













//useCase1report

app.get("/api/usecase1/report", async (req, res) =>{
  try{
    const {from, to, vehicleId}= req.query


    const filters= [];
    const params= [];
    


    if(from){
      filters.push("b.start_date >= ?");
      params.push(from);
    }

    if(to){
      filters.push("b.end_date <= ?");
      params.push(to);
    }

    if(vehicleId){
      filters.push("v.vehicle_id = ?");
      params.push(vehicleId);
    }

    let whereSql= "";
    if(filters.length>0){
      whereSql= " WHERE " + filters.join(" AND ");
    }


    const sql =
    "SELECT " +
    "b.booking_id, " +
    "p.name AS customer_name, " +
    "v.producer, " +
    "v.model, " +
    "b.start_date, " +
    "b.end_date, " +
    "v.costs_per_day, " +
    "GREATEST(DATEDIFF(b.end_date, b.start_date), 1) AS days, " +
    "(v.costs_per_day * GREATEST(DATEDIFF(b.end_date, b.start_date), 1)) AS base_cost, " +
    "COALESCE(SUM(s.costs), 0) AS additional_cost, " +
    "(v.costs_per_day * GREATEST(DATEDIFF(b.end_date, b.start_date), 1)) + COALESCE(SUM(s.costs), 0) AS total_cost " +
    "FROM Booking b " +
    "JOIN Customer c ON c.person_id = b.customer_id " +
    "JOIN Person p ON p.id = c.person_id " +
    "JOIN Vehicle v ON v.vehicle_id = b.vehicle_id " +
    "LEFT JOIN Bookings_Services bs ON bs.booking_id = b.booking_id " +
    "LEFT JOIN AdditionalService s ON s.additional_service_id = bs.additional_service_id " +
    whereSql +
    "GROUP BY b.booking_id, p.name, v.producer, v.model, b.start_date, b.end_date, v.costs_per_day " +
    "ORDER BY b.start_date DESC";

    const [rows]= await pool.query(sql, params);
    res.json({ report: rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
  
});

app.post("/api/usecase1/bookings", async (req, res) => {
  const { customerId, vehicleId, startDate, endDate, wayOfBilling } =
    req.body || {};
  if (!vehicleId || !startDate || !endDate || !wayOfBilling) {
    return res.status(400).json({ error: "Missing fields" });
  }

  let resolvedCustomerId = customerId;
  if (!resolvedCustomerId) {
    const [customerRows] = await pool.query(
      "SELECT person_id FROM Customer ORDER BY person_id LIMIT 1"
    );
    if (customerRows.length === 0) {
      return res.status(400).json({ error: "No customers available" });
    }
    resolvedCustomerId = customerRows[0].person_id;
  }

  const [veh] = await pool.query(
    "SELECT costs_per_day FROM Vehicle WHERE vehicle_id = ?",
    [vehicleId]
  );
  if (veh.length === 0) return res.status(400).json({ error: "Invalid vehicle" });

  const bookingId = `b_${Date.now()}`;
  const days = Math.max(
    Math.ceil((new Date(endDate) - new Date(startDate)) / 86400000),
    1
  );
  const total = (Number(veh[0].costs_per_day) || 0) * days;

  await pool.query(
    `INSERT INTO Booking (booking_id, start_date, end_date, total_costs, way_of_billing, customer_id, vehicle_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      bookingId,
      startDate,
      endDate,
      total,
      wayOfBilling,
      resolvedCustomerId,
      vehicleId,
    ]
  );

  res.json({ ok: true, booking_id: bookingId, total_costs: total });
});
















app.post("/api/migrate-nosql", async (req, res) => {
  try {
    await migrateToMongo();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Migration failed" });
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
