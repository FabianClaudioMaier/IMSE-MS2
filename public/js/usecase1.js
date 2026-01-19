export function initUsecase1({ actions, state }) {
  let uc1CustomersLoaded = false;
  let uc1DefaultCustomerId = null;
  state.usecase1ApiBase = state.usecase1ApiBase || "/api/usecase1";

  const customerSelect = document.getElementById("uc1-customer");
  const startInput = document.getElementById("uc1-start");
  const endInput = document.getElementById("uc1-end");
  const searchButton = document.getElementById("uc1-search");
  const statusParagraph = document.getElementById("uc1-status");
  const vehiclesDiv = document.getElementById("uc1-vehicles");
  const summaryDiv = document.getElementById("uc1-result");

  function setUc1Status(text) {
    if (statusParagraph) {
      statusParagraph.textContent = text || "";
    }
  }

  function setSummary(obj) {
    if (!summaryDiv) {
      return;
    }
    summaryDiv.textContent =
      typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  }

  async function getJson(url) {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Request failed");
    }
    return data;
  }

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Request failed");
    }
    return data;
  }

  async function loadUc1Customers() {
    try {
      setUc1Status("Loading customers...");
      const data = await getJson(`${state.usecase1ApiBase}/customers`);

      if (data.customers && data.customers.length > 0) {
        uc1DefaultCustomerId = data.customers[0].person_id;
      } else {
        uc1DefaultCustomerId = null;
      }
      if (customerSelect) {
        customerSelect.innerHTML = "";
        for (const customer of data.customers) {
          const opt = document.createElement("option");
          opt.value = customer.person_id;
          opt.textContent = `${customer.name}`;
          customerSelect.appendChild(opt);
        }
      }

      if (!uc1DefaultCustomerId) {
        setUc1Status("No customers available. Generate data first.");
        return;
      }

      setUc1Status("");
      uc1CustomersLoaded = true;
    } catch (e) {
      setUc1Status("Error:" + e.message);
    }
  }

  async function searchVehicles(options = {}) {
    const { preserveStatus = false } = options;
    if (vehiclesDiv) {
      vehiclesDiv.innerHTML = "";
    }
    if (!preserveStatus) {
      setSummary("");
    }
    let start;
    let end;
    let customerId;

    if (startInput != null) {
      start = startInput.value;
    } else {
      start = "";
    }
    if (endInput != null) {
      end = endInput.value;
    } else {
      end = "";
    }
    if (customerSelect != null) {
      customerId = customerSelect.value;
    } else {
      customerId = uc1DefaultCustomerId;
    }
    if (!customerId) {
      setUc1Status("No customers available. Generate data first.");
      return;
    }
    if (!start || !end) {
      setUc1Status("Please select start and end date.");
      return;
    }
    if (new Date(start) >= new Date(end)) {
      setUc1Status("Start date must be before end date.");
      return;
    }

    try {
      if (!preserveStatus) {
        setUc1Status("Searching vehicles...");
      }
      const data = await getJson(
        `${state.usecase1ApiBase}/vehicles?start=${start}&end=${end}`
      );

      if (!preserveStatus) {
        setUc1Status("");
      }

      if (data.vehicles.length === 0) {
        if (!preserveStatus) {
          setUc1Status("No vehicles available.");
        }
        return;
      }

      for (const vehicle of data.vehicles) {
        const row = document.createElement("div");
        row.textContent = `${vehicle.producer} ${vehicle.model} | ${vehicle.plate_number} | €${vehicle.costs_per_day}/day`;
        const button = document.createElement("button");
        button.textContent = "Reserve";
        button.onclick = () =>
          reserveVehicle(vehicle.vehicle_id, start, end, customerId);
        row.appendChild(button);

        if (vehiclesDiv != null) {
          vehiclesDiv.appendChild(row);
        }
      }
    } catch (e) {
      setUc1Status("Error: " + e.message);
    }
  }

  async function reserveVehicle(vehicleId, startDate, endDate, customerId) {
    try {
      setUc1Status("Creating reservation...");

      const payload = {
        customerId: customerId,
        vehicleId: vehicleId,
        startDate: startDate,
        endDate: endDate,
        wayOfBilling: "BANK_TRANSFER",
      };

      const data = await postJson(`${state.usecase1ApiBase}/bookings`, payload);

      setUc1Status("Reservation created!");
      setSummary(data);

      await searchVehicles({ preserveStatus: true });
    } catch (e) {
      setUc1Status("Error: " + e.message);
    }
  }

  if (searchButton) {
    searchButton.addEventListener("click", searchVehicles);
  }

  actions.loadUc1Customers = loadUc1Customers;
  actions.ensureUc1Customers = () => {
    if (!uc1CustomersLoaded) {
      loadUc1Customers();
    }
  };
  actions.resetUseCase1State = async () => {
    state.usecase1ApiBase = "/api/usecase1";
    uc1CustomersLoaded = false;
    uc1DefaultCustomerId = null;
    await loadUc1Customers();
  };
}
