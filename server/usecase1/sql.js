const { pool } = require("../system/db");

async function getCustomers() {
  const [rows] = await pool.query(
    `SELECT p.id AS person_id, p.name, c.customer_number, c.driver_licencse_number, b.iban
     FROM Customer c
     JOIN Person p ON p.id = c.person_id
     JOIN Bankaccount b ON b.person_id = c.person_id
     ORDER BY p.name`
  );
  return rows;
}

async function getVehicles(start, end) {
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
  return rows;
}

async function getReport(filters) {
  const { from, to } = filters || {};
  const conditions = [];
  const params = [];

  if (from) {
    conditions.push("b.start_date >= ?");
    params.push(from);
  }
  if (to) {
    conditions.push("b.end_date <= ?");
    params.push(to);
  }
  const whereSql = conditions.length ? " WHERE " + conditions.join(" AND ") : "";

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

  const [rows] = await pool.query(sql, params);
  return rows;
}

async function createBooking(payload) {
  const { customerId, vehicleId, startDate, endDate, wayOfBilling } = payload;

  const [veh] = await pool.query(
    "SELECT costs_per_day FROM Vehicle WHERE vehicle_id = ?",
    [vehicleId]
  );
  if (veh.length === 0) {
    const error = new Error("Invalid vehicle");
    error.status = 400;
    throw error;
  }

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
      customerId,
      vehicleId,
    ]
  );

  return { ok: true, booking_id: bookingId, total_costs: total };
}

module.exports = {
  getCustomers,
  getVehicles,
  getReport,
  createBooking,
};
