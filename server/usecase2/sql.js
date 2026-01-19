const { pool } = require("../system/db");

function buildInClause(values) {
  return values.map(() => "?").join(", ");
}

async function getCustomers() {
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
  return rows;
}

async function getBookings(customerId) {
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

  return rows.map((row) => {
    const baseCost = Number(row.base_cost) || 0;
    const extrasCost = Number(row.extras_cost) || 0;
    return {
      ...row,
      base_cost: baseCost,
      extras_cost: extrasCost,
      total_cost: baseCost + extrasCost,
    };
  });
}

async function getServices(bookingId) {
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

  return { available, current };
}

async function addServices(bookingId, payload) {
  const { customerId, serviceIds } = payload;
  const uniqueServiceIds = [...new Set(serviceIds)];

  const [bookingRows] = await pool.query(
    `SELECT booking_id
     FROM Booking
     WHERE booking_id = ? AND customer_id = ? AND start_date >= CURDATE()`,
    [bookingId, customerId]
  );

  if (bookingRows.length === 0) {
    return { error: "Booking not found or inactive", status: 404 };
  }

  const [bankRows] = await pool.query(
    "SELECT 1 FROM Bankaccount WHERE person_id = ?",
    [customerId]
  );

  if (bankRows.length === 0) {
    return { error: "Customer has no bank account", status: 400 };
  }

  const serviceClause = buildInClause(uniqueServiceIds);
  const [serviceRows] = await pool.query(
    `SELECT additional_service_id
     FROM AdditionalService
     WHERE additional_service_id IN (${serviceClause})`,
    uniqueServiceIds
  );

  if (serviceRows.length !== uniqueServiceIds.length) {
    return { error: "Invalid additional service selection", status: 400 };
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
  const baseCost = Number(totals.base_cost) || 0;
  const extrasCost = Number(totals.extras_cost) || 0;
  const totalCost = baseCost + extrasCost;

  await pool.query("UPDATE Booking SET total_costs = ? WHERE booking_id = ?", [
    totalCost,
    bookingId,
  ]);

  return { baseCost, extrasCost, totalCost };
}

async function getReport(filters) {
  const { from, to } = filters;
  const conditions = [];
  const params = [];

  if (from) {
    conditions.push("b.start_date >= ?");
    params.push(from);
  }

  if (to) {
    conditions.push("b.start_date < ?");
    params.push(to);
  }

  const whereSql = conditions.length ? " WHERE " + conditions.join(" AND ") : "";

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
  return rows;
}

module.exports = {
  getCustomers,
  getBookings,
  getServices,
  addServices,
  getReport,
};
