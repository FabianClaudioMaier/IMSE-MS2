const { getMongoDb } = require("../system/db");

async function getCustomers() {
  const db = await getMongoDb();
  const customers = await db
    .collection("persons")
    .find({ "roles.customer": { $ne: null } })
    .sort({ name: 1 })
    .toArray();

  return customers.map((person) => ({
    person_id: person._id,
    name: person.name,
    customer_number: person.roles?.customer?.customer_number ?? null,
    driver_licencse_number: person.roles?.customer?.driver_licencse_number ?? null,
    iban: person.bankAccount ? person.bankAccount.iban : null,
  }));
}

async function getVehicles(start, end) {
  const db = await getMongoDb();
  const bookedVehiclesId = await db.collection("bookings").distinct(
    "vehicle.vehicle_id",
    {
      start_date: { $lte: end },
      end_date: { $gte: start },
    }
  );
  const vehicles = await db
    .collection("vehicles")
    .find({ _id: { $nin: bookedVehiclesId } })
    .toArray();

  return vehicles.map((vehicle) => ({
    vehicle_id: vehicle._id,
    model: vehicle.model,
    producer: vehicle.producer,
    costs_per_day: vehicle.costs_per_day,
    plate_number: vehicle.plate_number,
  }));
}

async function createBooking(payload) {
  const { customerId, vehicleId, startDate, endDate, wayOfBilling } =
    payload || {};

  if (!vehicleId || !startDate || !endDate || !wayOfBilling) {
    const error = new Error("Missing fields");
    error.status = 400;
    throw error;
  }

  const db = await getMongoDb();

  let resolvedCustomerId = customerId;
  if (!resolvedCustomerId) {
    const firstCustomer = await db
      .collection("persons")
      .find({ "roles.customer": { $ne: null } })
      .sort({ name: 1 })
      .limit(1)
      .toArray();
    if (firstCustomer.length === 0) {
      const error = new Error("No customers available");
      error.status = 400;
      throw error;
    }
    resolvedCustomerId = firstCustomer[0]._id;
  }

  const customer = await db
    .collection("persons")
    .findOne({ _id: resolvedCustomerId });
  if (!customer) {
    const error = new Error("Invalid customer");
    error.status = 400;
    throw error;
  }

  const vehicle = await db.collection("vehicles").findOne({ _id: vehicleId });
  if (!vehicle) {
    const error = new Error("Invalid vehicle");
    error.status = 400;
    throw error;
  }

  const retailerId = vehicle.retailer_id ?? null;
  let retailer = null;
  if (retailerId) {
    const retailerDoc = await db.collection("persons").findOne(
      { _id: retailerId },
      { projection: { "roles.retailer": 1 } }
    );
    retailer = {
      person_id: retailerId,
      company_name: retailerDoc?.roles?.retailer?.company_name ?? null,
    };
  }

  const bookingId = `b_${Date.now()}`;
  const days = Math.max(
    Math.ceil((new Date(endDate) - new Date(startDate)) / 86400000),
    1
  );
  const total = (Number(vehicle.costs_per_day) || 0) * days;

  const doc = {
    _id: bookingId,
    start_date: startDate,
    end_date: endDate,
    way_of_billing: wayOfBilling,
    customer: { person_id: customer._id, name: customer.name },
    vehicle: {
      vehicle_id: vehicle._id,
      model: vehicle.model,
      producer: vehicle.producer,
      costs_per_day: vehicle.costs_per_day,
      retailer_id: vehicle.retailer_id ?? null,
    },
    retailer,
    additionalServices: [],
    pricing: { total_costs: total },
  };

  await db.collection("bookings").insertOne(doc);
  return { ok: true, booking_id: bookingId, total_costs: total };
}

async function getReport(filters) {
  const { from, to } = filters || {};
  const db = await getMongoDb();
  const query = {};

  if (from) {
    query.start_date = { $gte: from };
  }
  if (to) {
    query.end_date = { $lte: to };
  }
  const aggregatePipeline = [
    { $match: query },
    {
      $addFields: {
        startD: {
          $dateFromString: { dateString: "$start_date", format: "%Y-%m-%d" },
        },
        endD: {
          $dateFromString: { dateString: "$end_date", format: "%Y-%m-%d" },
        },
      },
    },
    {
      $addFields: {
        costPerDayNum: {
          $convert: {
            input: "$vehicle.costs_per_day",
            to: "double",
            onError: 0,
            onNull: 0,
          },
        },
        days: {
          $max: [
            {
              $ceil: {
                $divide: [{ $subtract: ["$endD", "$startD"] }, 86400000],
              },
            },
            1,
          ],
        },
        additional_cost: {
          $sum: {
            $map: {
              input: { $ifNull: ["$additionalServices", []] },
              as: "s",
              in: {
                $convert: {
                  input: "$$s.costs",
                  to: "double",
                  onError: 0,
                  onNull: 0,
                },
              },
            },
          },
        },
      },
    },
    {
      $addFields: {
        base_cost: {
          $ifNull: [{ $multiply: ["$costPerDayNum", "$days"] }, 0],
        },
      },
    },
    {
      $addFields: {
        total_cost: {
          $add: [
            { $ifNull: ["$base_cost", 0] },
            { $ifNull: ["$additional_cost", 0] },
          ],
        },
      },
    },
    {
      $project: {
        booking_id: "$_id",
        customer_name: "$customer.name",
        producer: "$vehicle.producer",
        model: "$vehicle.model",
        start_date: 1,
        end_date: 1,
        costs_per_day: "$costPerDayNum",
        days: 1,
        base_cost: 1,
        additional_cost: 1,
        total_cost: 1,
      },
    },
  ];

  return db.collection("bookings").aggregate(aggregatePipeline).toArray();
}

module.exports = {
  getCustomers,
  getVehicles,
  createBooking,
  getReport,
};
