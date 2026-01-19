const express = require("express");
const { pool, getMongoDb, setDbMode } = require("./db");

async function migrateToMongo() {
  const db = await getMongoDb();

  await Promise.all([
    db.collection("persons").deleteMany({}),
    db.collection("vehicles").deleteMany({}),
    db.collection("services").deleteMany({}),
    db.collection("bookings").deleteMany({}),
    db.collection("ratings").deleteMany({}),
  ]);

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

  if (persons.length) {
    await db.collection("persons").insertMany(
      persons.map((person) => ({
        _id: person.id,
        name: person.name,
        phone_number: person.phone_number,
        eMail: person.eMail,
        address: person.address,
        stars: person.stars,
        roles: {
          customer: person.customer_number
            ? {
                customer_number: person.customer_number,
                driver_licencse_number: person.driver_licencse_number,
              }
            : null,
          retailer: person.company_name
            ? {
                company_name: person.company_name,
                tax_number: person.tax_number,
              }
            : null,
        },
        bankAccount: person.account_id
          ? {
              account_id: person.account_id,
              iban: person.iban,
              bic: person.bic,
            }
          : null,
      }))
    );
  }

  if (vehicles.length) {
    await db.collection("vehicles").insertMany(
      vehicles.map((vehicle) => ({
        _id: vehicle.vehicle_id,
        model: vehicle.model,
        producer: vehicle.producer,
        costs_per_day: vehicle.costs_per_day,
        plate_number: vehicle.plate_number,
        number_of_seats: vehicle.number_of_seats,
        retailer_id: vehicle.retailer_id,
      }))
    );
  }

  if (services.length) {
    await db.collection("services").insertMany(
      services.map((service) => ({
        _id: service.additional_service_id,
        description: service.description,
        costs: service.costs,
      }))
    );
  }

  if (ratings.length) {
    await db.collection("ratings").insertMany(
      ratings.map((rating) => ({
        _id: { rater_id: rating.rater_id, rated_id: rating.rated_id },
        stars: rating.stars,
      }))
    );
  }

  const [bookings] = await pool.query(`
    SELECT b.booking_id, b.start_date, b.end_date, b.total_costs, b.way_of_billing,
           c.person_id AS customer_id, p.name AS customer_name,
           v.vehicle_id, v.model, v.producer, v.costs_per_day,
           v.plate_number, v.number_of_seats,
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
          plate_number: row.plate_number,
          number_of_seats: row.number_of_seats,
          retailer_id: row.retailer_id,
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
}

const router = express.Router();

router.post("/migrate-nosql", async (req, res) => {
  try {
    await migrateToMongo();
    setDbMode("nosql");
    res.json({ ok: true, mode: "nosql" });
  } catch (err) {
    res.status(500).json({ error: "Migration failed" });
  }
});

module.exports = { router };
