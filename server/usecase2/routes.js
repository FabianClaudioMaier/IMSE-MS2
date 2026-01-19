const express = require("express");
const { isNoSqlMode } = require("../system/db");
const sql = require("./sql");
const nosql = require("./nosql");

const router = express.Router();

router.get("/usecase/customers", async (req, res) => {
  try {
    const customers = isNoSqlMode()
      ? await nosql.getCustomers()
      : await sql.getCustomers();
    res.json({ customers });
  } catch (err) {
    res.status(500).json({ error: "Failed to load customers" });
  }
});

router.get("/usecase/bookings", async (req, res) => {
  const customerId = req.query.customerId;
  if (!customerId) {
    res.status(400).json({ error: "Missing customerId" });
    return;
  }

  try {
    const bookings = isNoSqlMode()
      ? await nosql.getBookings(customerId)
      : await sql.getBookings(customerId);
    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ error: "Failed to load bookings" });
  }
});

router.get("/usecase/bookings/:id/services", async (req, res) => {
  const bookingId = req.params.id;

  try {
    if (isNoSqlMode()) {
      const result = await nosql.getServices(bookingId);
      if (!result) {
        res.status(404).json({ error: "Booking not found" });
        return;
      }
      res.json(result);
      return;
    }

    const result = await sql.getServices(bookingId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to load services" });
  }
});

router.post("/usecase/bookings/:id/services", async (req, res) => {
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

  try {
    const result = isNoSqlMode()
      ? await nosql.addServices(bookingId, { customerId, serviceIds })
      : await sql.addServices(bookingId, { customerId, serviceIds });

    if (result.error) {
      res.status(result.status || 400).json({ error: result.error });
      return;
    }

    res.json({
      ok: true,
      base_cost: result.baseCost,
      extras_cost: result.extrasCost,
      total_cost: result.totalCost,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to add additional services" });
  }
});

router.get("/usecase2/report", async (req, res) => {
  try {
    const report = isNoSqlMode()
      ? await nosql.getReport(req.query || {})
      : await sql.getReport(req.query || {});
    res.json({ report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

module.exports = { router };
