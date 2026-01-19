const express = require("express");
const { isNoSqlMode } = require("../system/db");
const sql = require("./sql");
const nosql = require("./nosql");

const router = express.Router();

router.get("/usecase1/customers", async (req, res) => {
  try {
    const customers = isNoSqlMode()
      ? await nosql.getCustomers()
      : await sql.getCustomers();
    res.json({ customers });
  } catch (err) {
    const message = isNoSqlMode()
      ? "NoSQL: No chance to get customer data"
      : "No chance to get customer data";
    res.status(500).json({ error: message });
  }
});

router.get("/usecase1/vehicles", async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) {
    res.status(400).json({ error: "Missing dates" });
    return;
  }

  try {
    const vehicles = isNoSqlMode()
      ? await nosql.getVehicles(start, end)
      : await sql.getVehicles(start, end);
    res.json({ vehicles });
  } catch (err) {
    const message = isNoSqlMode()
      ? "NoSQL failed to load vehicles"
      : "Failed to load vehicles";
    res.status(500).json({ error: message });
  }
});

router.get("/usecase1/report", async (req, res) => {
  try {
    const report = isNoSqlMode()
      ? await nosql.getReport(req.query || {})
      : await sql.getReport(req.query || {});
    res.json({ report });
  } catch (err) {
    const message = isNoSqlMode()
      ? "database error (NoSQL)"
      : "database error";
    res.status(500).json({ error: message });
  }
});

router.post("/usecase1/bookings", async (req, res) => {
  const { customerId, vehicleId, startDate, endDate, wayOfBilling } =
    req.body || {};

  if (!vehicleId || !startDate || !endDate || !wayOfBilling) {
    res.status(400).json({ error: "Missing fields" });
    return;
  }

  if (!isNoSqlMode() && !customerId) {
    res.status(400).json({ error: "Missing customerId" });
    return;
  }

  try {
    const result = isNoSqlMode()
      ? await nosql.createBooking({
          customerId,
          vehicleId,
          startDate,
          endDate,
          wayOfBilling,
        })
      : await sql.createBooking({
          customerId,
          vehicleId,
          startDate,
          endDate,
          wayOfBilling,
        });
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status !== 500) {
      res.status(status).json({ error: err.message });
      return;
    }
    const message = isNoSqlMode()
      ? "NoSql: Failed to create booking (NoSQL)"
      : "Failed to create booking";
    res.status(500).json({ error: message });
  }
});

module.exports = { router };
