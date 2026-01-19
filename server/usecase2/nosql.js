const { getMongoDb, calcRentalDays, asNumber } = require("../system/db");

async function getCustomers() {
  const db = await getMongoDb();
  const customers = await db
    .collection("persons")
    .find({ "roles.customer": { $ne: null }, bankAccount: { $ne: null } })
    .sort({ name: 1 })
    .toArray();

  return customers.map((person) => ({
    person_id: person._id,
    name: person.name,
    eMail: person.eMail,
    phone_number: person.phone_number,
    address: person.address,
    customer_number: person.roles?.customer?.customer_number,
    driver_licencse_number: person.roles?.customer?.driver_licencse_number,
    account_id: person.bankAccount?.account_id,
    iban: person.bankAccount?.iban,
    bic: person.bankAccount?.bic,
  }));
}

async function getBookings(customerId) {
  const db = await getMongoDb();
  const todayStr = new Date().toISOString().slice(0, 10);

  const bookings = await db
    .collection("bookings")
    .find({
      "customer.person_id": customerId,
      start_date: { $gte: todayStr },
    })
    .sort({ start_date: 1, _id: 1 })
    .toArray();

  if (bookings.length === 0) {
    return [];
  }

  const vehicleIds = bookings
    .map((booking) => booking.vehicle?.vehicle_id)
    .filter(Boolean);
  const vehicles = vehicleIds.length
    ? await db
        .collection("vehicles")
        .find({ _id: { $in: vehicleIds } })
        .toArray()
    : [];
  const vehicleMap = new Map(vehicles.map((vehicle) => [vehicle._id, vehicle]));

  return bookings.map((booking) => {
    const vehicleInfo = booking.vehicle || {};
    const vehicleRef = vehicleMap.get(vehicleInfo.vehicle_id) || {};
    const costsPerDay = asNumber(
      vehicleInfo.costs_per_day ?? vehicleRef.costs_per_day
    );
    const days = calcRentalDays(booking.start_date, booking.end_date);
    const baseCost = days * costsPerDay;
    const extrasCost = (booking.additionalServices || []).reduce(
      (sum, service) => sum + asNumber(service.costs),
      0
    );
    const totalCost = baseCost + extrasCost;

    return {
      booking_id: booking._id,
      start_date: booking.start_date,
      end_date: booking.end_date,
      way_of_billing: booking.way_of_billing,
      vehicle_id: vehicleInfo.vehicle_id,
      total_costs: booking.pricing?.total_costs ?? null,
      model: vehicleInfo.model ?? vehicleRef.model,
      producer: vehicleInfo.producer ?? vehicleRef.producer,
      costs_per_day: costsPerDay,
      plate_number: vehicleInfo.plate_number ?? vehicleRef.plate_number,
      number_of_seats: vehicleInfo.number_of_seats ?? vehicleRef.number_of_seats,
      days,
      base_cost: baseCost,
      extras_cost: extrasCost,
      total_cost: totalCost,
    };
  });
}

async function getServices(bookingId) {
  const db = await getMongoDb();
  const booking = await db.collection("bookings").findOne({ _id: bookingId });
  if (!booking) {
    return null;
  }

  const current = (booking.additionalServices || []).map((service) => ({
    additional_service_id: service.service_id,
    description: service.description,
    costs: service.costs,
  }));
  current.sort((a, b) => a.description.localeCompare(b.description));

  const currentIds = new Set(
    current.map((service) => service.additional_service_id)
  );
  const services = await db
    .collection("services")
    .find()
    .sort({ description: 1 })
    .toArray();
  const available = services
    .filter((service) => !currentIds.has(service._id))
    .map((service) => ({
      additional_service_id: service._id,
      description: service.description,
      costs: service.costs,
    }));

  return { available, current };
}

async function addServices(bookingId, payload) {
  const { customerId, serviceIds } = payload;
  const db = await getMongoDb();
  const todayStr = new Date().toISOString().slice(0, 10);

  const booking = await db.collection("bookings").findOne({
    _id: bookingId,
    "customer.person_id": customerId,
    start_date: { $gte: todayStr },
  });
  if (!booking) {
    return { error: "Booking not found or inactive", status: 404 };
  }

  const person = await db.collection("persons").findOne(
    { _id: customerId },
    { projection: { bankAccount: 1 } }
  );
  if (!person?.bankAccount) {
    return { error: "Customer has no bank account", status: 400 };
  }

  const uniqueServiceIds = [...new Set(serviceIds)];
  const services = await db
    .collection("services")
    .find({ _id: { $in: uniqueServiceIds } })
    .toArray();
  if (services.length !== uniqueServiceIds.length) {
    return { error: "Invalid additional service selection", status: 400 };
  }

  const existingServices = booking.additionalServices || [];
  const existingIds = new Set(
    existingServices.map((service) => service.service_id)
  );
  const newServices = services
    .filter((service) => !existingIds.has(service._id))
    .map((service) => ({
      service_id: service._id,
      description: service.description,
      costs: service.costs,
    }));
  const updatedServices = existingServices.concat(newServices);

  const costsPerDay = asNumber(booking.vehicle?.costs_per_day);
  const days = calcRentalDays(booking.start_date, booking.end_date);
  const baseCost = days * costsPerDay;
  const extrasCost = updatedServices.reduce(
    (sum, service) => sum + asNumber(service.costs),
    0
  );
  const totalCost = baseCost + extrasCost;

  await db.collection("bookings").updateOne(
    { _id: bookingId },
    {
      $set: {
        additionalServices: updatedServices,
        "pricing.total_costs": totalCost,
      },
    }
  );

  return { baseCost, extrasCost, totalCost };
}

async function getReport(filters) {
  const db = await getMongoDb();
  const query = { "additionalServices.0": { $exists: true } };

  if (filters.from || filters.to) {
    query.start_date = {};
    if (filters.from) {
      query.start_date.$gte = filters.from;
    }
    if (filters.to) {
      query.start_date.$lt = filters.to;
    }
  }

  const bookings = await db
    .collection("bookings")
    .find(query)
    .sort({ start_date: -1 })
    .toArray();

  if (bookings.length === 0) {
    return [];
  }

  const customerIds = [
    ...new Set(
      bookings.map((booking) => booking.customer?.person_id).filter(Boolean)
    ),
  ];
  const persons = customerIds.length
    ? await db
        .collection("persons")
        .find({ _id: { $in: customerIds } }, { projection: { bankAccount: 1 } })
        .toArray()
    : [];
  const personMap = new Map(persons.map((person) => [person._id, person]));

  const retailerIds = [
    ...new Set(
      bookings
        .map(
          (booking) =>
            booking.retailer?.person_id ?? booking.vehicle?.retailer_id
        )
        .filter(Boolean)
    ),
  ];
  const retailers = retailerIds.length
    ? await db
        .collection("persons")
        .find(
          { _id: { $in: retailerIds } },
          { projection: { "roles.retailer": 1 } }
        )
        .toArray()
    : [];
  const retailerMap = new Map(
    retailers.map((retailer) => [retailer._id, retailer])
  );

  return bookings.map((booking) => {
    const vehicle = booking.vehicle || {};
    const additionalServices = booking.additionalServices || [];
    const rentalDays = calcRentalDays(booking.start_date, booking.end_date);
    const costPerDay = asNumber(vehicle.costs_per_day);
    const baseCost = rentalDays * costPerDay;
    const additionalCosts = additionalServices.reduce(
      (sum, service) => sum + asNumber(service.costs),
      0
    );
    const totalCost = baseCost + additionalCosts;
    const servicesList = additionalServices
      .map((service) => service.description)
      .sort((a, b) => a.localeCompare(b))
      .join(", ");

    const customerId = booking.customer?.person_id ?? null;
    const person = customerId ? personMap.get(customerId) : null;
    const bankAccount = person?.bankAccount || {};
    const retailerId =
      booking.retailer?.person_id ?? booking.vehicle?.retailer_id ?? null;
    const retailerDoc = retailerId ? retailerMap.get(retailerId) : null;
    const retailerName =
      booking.retailer?.company_name ??
      retailerDoc?.roles?.retailer?.company_name ??
      null;

    return {
      booking_id: booking._id,
      start_date: booking.start_date,
      end_date: booking.end_date,
      customer_id: customerId,
      customer_name: booking.customer?.name ?? null,
      customer_iban: bankAccount.iban ?? null,
      customer_bic: bankAccount.bic ?? null,
      vehicle_id: vehicle.vehicle_id ?? null,
      model: vehicle.model ?? null,
      producer: vehicle.producer ?? null,
      retailer_id: retailerId,
      retailer_name: retailerName,
      rental_days: rentalDays,
      cost_per_day: costPerDay,
      base_cost: baseCost,
      additional_costs: additionalCosts,
      additional_services_count: additionalServices.length,
      total_cost: totalCost,
      additional_services_list: servicesList || null,
    };
  });
}

module.exports = {
  getCustomers,
  getBookings,
  getServices,
  addServices,
  getReport,
};
