const viewButtons = document.querySelectorAll("[data-view]");
const views = {
  home: document.getElementById("view-home"),
  usecase1: document.getElementById("view-usecase1"),
  usecase2: document.getElementById("view-usecase2"),
  explore: document.getElementById("view-explore"),
};

function setView(viewName) {
  Object.entries(views).forEach(([name, view]) => {
    if (!view) {
      return;
    }
    view.classList.toggle("active", name === viewName);
  });

  viewButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });

  if (viewName === "usecase2" && ucCustomers.length === 0) {
    loadUseCaseCustomers();
  }
  if (viewName === "usecase1" && uc1Customers.length === 0) {
    loadUc1Customers();
  }
}

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setView(button.dataset.view);
  });
});

const homeUc1Button = document.getElementById("home-uc1");
const homeUc2Button = document.getElementById("home-uc2");
const homeNote = document.getElementById("home-note");

if (homeUc1Button) {
  homeUc1Button.addEventListener("click", () => {
    setView("usecase1");
  });
}

if (homeUc2Button) {
  homeUc2Button.addEventListener("click", () => {
    setView("usecase2");
  });
}

// -----------------------------
// Data explorer (Explore Data)
// -----------------------------

const tableButtons = document.getElementById("table-buttons");
const limitInput = document.getElementById("limit");
const searchInput = document.getElementById("search");
const refreshButton = document.getElementById("refresh");
const generateButton = document.getElementById("generate");
const generateHint = document.getElementById("generate-hint");
const statusEl = document.getElementById("status");
const tableTitle = document.getElementById("table-title");
const tableMeta = document.getElementById("table-meta");
const tableCount = document.getElementById("table-count");
const rowCount = document.getElementById("row-count");
const tableEl = document.getElementById("data-table");
const tableHead = tableEl ? tableEl.querySelector("thead") : null;
const tableBody = tableEl ? tableEl.querySelector("tbody") : null;

let currentTable = null;
let currentColumns = [];
let currentRows = [];
const generateLabel = generateButton ? generateButton.textContent : "";

function setStatus(message, isError = false) {
  if (!statusEl) {
    return;
  }
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function formatCell(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function renderTable(columns, rows) {
  if (!tableHead || !tableBody) {
    return;
  }

  tableHead.innerHTML = "";
  tableBody.innerHTML = "";

  if (columns.length === 0) {
    return;
  }

  const headRow = document.createElement("tr");
  columns.forEach((column) => {
    const th = document.createElement("th");
    th.textContent = column;
    headRow.appendChild(th);
  });
  tableHead.appendChild(headRow);

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    columns.forEach((column) => {
      const td = document.createElement("td");
      td.textContent = formatCell(row[column]);
      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });
}

function applyFilter() {
  if (!searchInput) {
    return;
  }

  const query = searchInput.value.trim().toLowerCase();
  const filteredRows = query
    ? currentRows.filter((row) =>
        Object.values(row).some((value) =>
          String(value ?? "").toLowerCase().includes(query)
        )
      )
    : currentRows;

  renderTable(currentColumns, filteredRows);

  if (!currentTable) {
    if (rowCount) {
      rowCount.textContent = "-";
    }
    if (tableMeta) {
      tableMeta.textContent = "Pick a table to see its rows.";
    }
    return;
  }

  if (query) {
    if (rowCount) {
      rowCount.textContent = `${filteredRows.length}/${currentRows.length}`;
    }
    if (tableMeta) {
      tableMeta.textContent = `Showing ${filteredRows.length} of ${currentRows.length} rows.`;
    }
  } else {
    if (rowCount) {
      rowCount.textContent = `${currentRows.length}`;
    }
    if (tableMeta) {
      tableMeta.textContent = `Showing ${currentRows.length} rows.`;
    }
  }
}

function setActiveButton(tableName) {
  if (!tableButtons) {
    return;
  }
  const buttons = tableButtons.querySelectorAll("button");
  buttons.forEach((button) => {
    button.classList.toggle("active", button.dataset.table === tableName);
  });
}

async function loadTable(tableName) {
  const limit = limitInput ? Number.parseInt(limitInput.value, 10) || 50 : 50;
  setStatus("Loading data...");

  try {
    const response = await fetch(
      `/api/table/${encodeURIComponent(tableName)}?limit=${limit}`
    );
    if (!response.ok) {
      throw new Error("Failed to load table");
    }
    const data = await response.json();
    currentTable = data.table;
    currentColumns = data.columns;
    currentRows = data.rows;

    if (tableTitle) {
      tableTitle.textContent = data.table;
    }
    setActiveButton(data.table);
    applyFilter();
    setStatus("Ready.");
  } catch (err) {
    setStatus("Failed to load data.", true);
  }
}

async function loadTables() {
  if (!tableButtons) {
    return;
  }

  try {
    const response = await fetch("/api/tables");
    if (!response.ok) {
      throw new Error("Failed to load tables");
    }
    const data = await response.json();
    tableButtons.innerHTML = "";

    data.tables.forEach((table) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = table;
      button.dataset.table = table;
      button.addEventListener("click", () => loadTable(table));
      tableButtons.appendChild(button);
    });

    if (tableCount) {
      tableCount.textContent = `${data.tables.length}`;
    }
  } catch (err) {
    setStatus("Failed to load table list.", true);
  }
}

function setGenerateState({ disabled, label, hint }) {
  if (!generateButton || !generateHint) {
    return;
  }
  generateButton.disabled = disabled;
  if (label) {
    generateButton.textContent = label;
  }
  if (hint) {
    generateHint.textContent = hint;
  }
}

async function loadSeedStatus() {
  if (!generateButton) {
    return;
  }

  try {
    const response = await fetch("/api/seed-status");
    if (!response.ok) {
      throw new Error("Failed to check seed status");
    }
    const data = await response.json();
    if (data.seeded) {
      setGenerateState({
        disabled: true,
        label: "Data Generated",
        hint: "Test data already generated.",
      });
    }
  } catch (err) {
    setStatus("Failed to check seed status.", true);
  }
}

async function generateData() {
  setGenerateState({
    disabled: true,
    label: "Generating...",
    hint: "Generating sample data. This may take a moment.",
  });
  setStatus("Generating sample data...");

  try {
    const response = await fetch("/api/generate", { method: "POST" });
    if (response.status === 409) {
      setGenerateState({
        disabled: true,
        label: "Data Generated",
        hint: "Test data already generated.",
      });
      setStatus("Data already generated.");
      return;
    }
    if (!response.ok) {
      throw new Error("Failed to generate data");
    }

    setGenerateState({
      disabled: true,
      label: "Data Generated",
      hint: "Test data already generated.",
    });

    if (currentTable) {
      await loadTable(currentTable);
    }
    setStatus("Sample data generated.");
    loadUseCaseCustomers();
  } catch (err) {
    setGenerateState({
      disabled: false,
      label: generateLabel,
      hint: "One-time action. Inserts up to 10 rows per table.",
    });
    setStatus("Failed to generate data.", true);
  }
}

if (refreshButton) {
  refreshButton.addEventListener("click", () => {
    if (currentTable) {
      loadTable(currentTable);
    }
  });
}

if (generateButton) {
  generateButton.addEventListener("click", () => {
    generateData();
  });
}

if (limitInput) {
  limitInput.addEventListener("change", () => {
    if (currentTable) {
      loadTable(currentTable);
    }
  });
}

if (searchInput) {
  searchInput.addEventListener("input", () => {
    applyFilter();
  });
}



// -----------------------------
// Use case Student 1 flow
// -----------------------------
const uc1CustomerSelect = document.getElementById("uc1-customer");
const uc1CustomerDetails = document.getElementById("uc1-customer-details");
const uc1StartDate = document.getElementById("uc1-start-date");
const uc1EndDate = document.getElementById("uc1-end-date");
const uc1CheckVehicles = document.getElementById("uc1-check-vehicles");
const uc1VehicleList = document.getElementById("uc1-vehicle-list");
const uc1VehicleStatus = document.getElementById("uc1-vehicle-status");
const uc1Summary = document.getElementById("uc1-summary");
const uc1ConfirmBooking = document.getElementById("uc1-confirm-booking");
const uc1PaymentPanel = document.getElementById("uc1-payment-panel");
const uc1ConfirmPayment = document.getElementById("uc1-confirm-payment");
const uc1CancelPayment = document.getElementById("uc1-cancel-payment");
const uc1Status = document.getElementById("uc1-status");

let uc1Customers = [];
let uc1SelectedCustomer = null;
let uc1Vehicles = [];
let uc1SelectedVehicle = null;


function setUc1Status(message, isError = false) {
  if (!uc1Status) return;
  uc1Status.textContent = message;
  uc1Status.classList.toggle("error", isError);
}

async function loadUc1Customers() {
  if (!uc1CustomerSelect) return;
  try {
    const res = await fetch("/api/usecase1/customers");
    const data = await res.json();
    uc1Customers = data.customers || [];
    uc1CustomerSelect.innerHTML = "<option value=''>Select a customer</option>";
    uc1Customers.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.person_id;
      opt.textContent = `${c.name} (${c.customer_number})`;
      uc1CustomerSelect.appendChild(opt);
    });
  } catch {
    setUc1Status("Failed to load customers.", true);
  }
}

function renderUc1CustomerDetails() {
  if (!uc1CustomerDetails) return;
  if (!uc1SelectedCustomer) {
    uc1CustomerDetails.textContent = "No customer selected.";
    return;
  }
  uc1CustomerDetails.innerHTML = `
    <div><strong>${uc1SelectedCustomer.name}</strong></div>
    <div>Customer #: ${uc1SelectedCustomer.customer_number}</div>
    <div>Driver license: ${uc1SelectedCustomer.driver_licencse_number}</div>
    <div>IBAN: ${uc1SelectedCustomer.iban}</div>
  `;
}

async function loadUc1Vehicles() {
  if (!uc1StartDate?.value || !uc1EndDate?.value) {
    setUc1Status("Select start and end date.", true);
    return;
  }
  try {
    const qs = new URLSearchParams({
      start: uc1StartDate.value,
      end: uc1EndDate.value,
    });
    const res = await fetch(`/api/usecase1/vehicles?${qs.toString()}`);
    const data = await res.json();
    uc1Vehicles = data.vehicles || [];
    renderUc1VehicleList();
  } catch {
    setUc1Status("Failed to load vehicles.", true);
  }
}

function renderUc1VehicleList() {
  if (!uc1VehicleList) return;
  uc1VehicleList.innerHTML = "";
  if (uc1Vehicles.length === 0) {
    uc1VehicleStatus.textContent = "No vehicles available.";
    return;
  }
  uc1VehicleStatus.textContent = "Select a vehicle.";
  uc1Vehicles.forEach((v) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "booking-card";
    if (uc1SelectedVehicle?.vehicle_id === v.vehicle_id) {
      card.classList.add("active");
    }
    card.innerHTML = `
      <div><strong>${v.producer} ${v.model}</strong></div>
      <div>Plate: ${v.plate_number}</div>
      <div>Costs/day: ${formatMoney(v.costs_per_day)}</div>
    `;
    card.addEventListener("click", () => {
      uc1SelectedVehicle = v;
      renderUc1VehicleList();
      renderUc1Summary();
    });
    uc1VehicleList.appendChild(card);
  });
}

function renderUc1Summary() {
  if (!uc1Summary) return;
  const days =
    uc1StartDate?.value && uc1EndDate?.value
      ? Math.max(
          (new Date(uc1EndDate.value) - new Date(uc1StartDate.value)) /
            (1000 * 60 * 60 * 24),
          1
        )
      : 0;
  const base =
    uc1SelectedVehicle ? days * Number(uc1SelectedVehicle.costs_per_day) : 0;

  uc1Summary.innerHTML = `
    <div class="summary-line"><span>Days</span><span>${days}</span></div>
    <div class="summary-line"><span>Estimated base cost</span><span>${formatMoney(base)}</span></div>
  `;

  if (uc1ConfirmBooking) {
    uc1ConfirmBooking.disabled = !uc1SelectedCustomer || !uc1SelectedVehicle;
  }
}

async function confirmUc1Booking() {
  if (!uc1SelectedCustomer || !uc1SelectedVehicle) {
    setUc1Status("Select customer and vehicle first.", true);
    return;
  }
  try {
    const res = await fetch("/api/usecase1/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: uc1SelectedCustomer.person_id,
        vehicleId: uc1SelectedVehicle.vehicle_id,
        startDate: uc1StartDate.value,
        endDate: uc1EndDate.value,
        wayOfBilling: "CreditCard",
        confirmPayment: true,
      }),
    });
    if (!res.ok) throw new Error();
    setUc1Status("Reservation created.");
  } catch {
    setUc1Status("Failed to create reservation.", true);
  }
}


if (uc1CustomerSelect) {
  uc1CustomerSelect.addEventListener("change", () => {
    const selectedId = uc1CustomerSelect.value;
    uc1SelectedCustomer =
      uc1Customers.find((c) => c.person_id === selectedId) || null;
    renderUc1CustomerDetails();
  });
}

if (uc1CheckVehicles) {
  uc1CheckVehicles.addEventListener("click", () => {
    loadUc1Vehicles();
  });
}

if (uc1ConfirmBooking) {
  uc1ConfirmBooking.addEventListener("click", () => {
    showUc1PaymentPanel();
    setUc1Status("Confirm payment to finalize reservation.");
  });
}

if (uc1ConfirmPayment) {
  uc1ConfirmPayment.addEventListener("click", () => {
    confirmUc1Booking();
  });
}

if (uc1CancelPayment) {
  uc1CancelPayment.addEventListener("click", () => {
    hideUc1PaymentPanel();
    setUc1Status("Payment canceled.");
  });
}

function showUc1PaymentPanel() {
  if (uc1PaymentPanel) {
    uc1PaymentPanel.classList.remove("hidden");
  }
}

function hideUc1PaymentPanel() {
  if (uc1PaymentPanel) {
    uc1PaymentPanel.classList.add("hidden");
  }
}



// -----------------------------
// Use case Student 2 flow
// -----------------------------

const ucCustomerSelect = document.getElementById("uc-customer");
const ucCustomerDetails = document.getElementById("uc-customer-details");
const ucBookingList = document.getElementById("uc-booking-list");
const ucBookingStatus = document.getElementById("uc-booking-status");
const ucCurrentServices = document.getElementById("uc-current-services");
const ucServiceList = document.getElementById("uc-service-list");
const ucSummary = document.getElementById("uc-summary");
const ucConfirmServices = document.getElementById("uc-confirm-services");
const ucPaymentPanel = document.getElementById("uc-payment-panel");
const ucConfirmPayment = document.getElementById("uc-confirm-payment");
const ucCancelPayment = document.getElementById("uc-cancel-payment");
const ucStatus = document.getElementById("uc-status");

let ucCustomers = [];
let ucBookings = [];
let ucSelectedCustomer = null;
let ucSelectedBooking = null;
let ucAvailableServices = [];
let ucCurrentServicesList = [];
let ucSelectedServiceIds = new Set();

const currencyFormatter = new Intl.NumberFormat("de-AT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

function formatMoney(value) {
  const number = Number(value) || 0;
  return currencyFormatter.format(number);
}

function setUseCaseStatus(message, isError = false) {
  if (!ucStatus) {
    return;
  }
  ucStatus.textContent = message;
  ucStatus.classList.toggle("error", isError);
}

function clearUseCaseData() {
  ucBookings = [];
  ucSelectedBooking = null;
  ucAvailableServices = [];
  ucCurrentServicesList = [];
  ucSelectedServiceIds = new Set();
  hidePaymentPanel();
  if (ucBookingList) {
    ucBookingList.innerHTML = "";
  }
  if (ucCurrentServices) {
    ucCurrentServices.innerHTML = "";
  }
  if (ucServiceList) {
    ucServiceList.innerHTML = "";
  }
  updateSummary();
}

function renderCustomerDetails() {
  if (!ucCustomerDetails) {
    return;
  }

  if (!ucSelectedCustomer) {
    ucCustomerDetails.textContent = "No customer selected.";
    return;
  }

  ucCustomerDetails.innerHTML = `
    <div><strong>${ucSelectedCustomer.name}</strong></div>
    <div>Customer #: ${ucSelectedCustomer.customer_number}</div>
    <div>Driver license: ${ucSelectedCustomer.driver_licencse_number}</div>
    <div>IBAN: ${ucSelectedCustomer.iban}</div>
    <div>Email: ${ucSelectedCustomer.eMail}</div>
  `;
}

async function loadUseCaseCustomers() {
  if (!ucCustomerSelect) {
    return;
  }

  try {
    const response = await fetch("/api/usecase/customers");
    if (!response.ok) {
      throw new Error("Failed to load customers");
    }
    const data = await response.json();
    ucCustomers = data.customers || [];
    ucCustomerSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a customer";
    ucCustomerSelect.appendChild(placeholder);

    ucCustomers.forEach((customer) => {
      const option = document.createElement("option");
      option.value = customer.person_id;
      option.textContent = `${customer.name} (${customer.customer_number})`;
      ucCustomerSelect.appendChild(option);
    });

    if (ucCustomers.length === 0) {
      setUseCaseStatus("No customers available. Generate data first.", true);
    }
  } catch (err) {
    setUseCaseStatus("Failed to load customers.", true);
  }
}

function renderBookingList() {
  if (!ucBookingList) {
    return;
  }

  ucBookingList.innerHTML = "";

  if (!ucSelectedCustomer) {
    if (ucBookingStatus) {
      ucBookingStatus.textContent = "Select a customer to load bookings.";
    }
    return;
  }

  if (ucBookings.length === 0) {
    if (ucBookingStatus) {
      ucBookingStatus.textContent = "No active bookings found for this customer.";
    }
    return;
  }

  if (ucBookingStatus) {
    ucBookingStatus.textContent = "Pick a booking to add services.";
  }

  ucBookings.forEach((booking) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "booking-card";
    if (ucSelectedBooking && ucSelectedBooking.booking_id === booking.booking_id) {
      card.classList.add("active");
    }

    card.innerHTML = `
      <div><strong>Booking ${booking.booking_id}</strong></div>
      <div>${booking.start_date} → ${booking.end_date}</div>
      <div>${booking.producer} ${booking.model} (${booking.plate_number})</div>
      <div>Base cost: ${formatMoney(booking.base_cost)}</div>
      <div>Current total: ${formatMoney(booking.total_cost)}</div>
    `;

    card.addEventListener("click", () => {
      ucSelectedBooking = booking;
      renderBookingList();
      loadServicesForBooking(booking.booking_id);
    });

    ucBookingList.appendChild(card);
  });
}

async function loadBookingsForCustomer(keepBookingId = null) {
  if (!ucSelectedCustomer) {
    clearUseCaseData();
    renderBookingList();
    return;
  }

  try {
    const response = await fetch(
      `/api/usecase/bookings?customerId=${encodeURIComponent(
        ucSelectedCustomer.person_id
      )}`
    );
    if (!response.ok) {
      throw new Error("Failed to load bookings");
    }

    const data = await response.json();
    ucBookings = data.bookings || [];

    if (keepBookingId) {
      ucSelectedBooking =
        ucBookings.find((booking) => booking.booking_id === keepBookingId) || null;
    } else {
      ucSelectedBooking = null;
    }

    renderBookingList();
    if (ucSelectedBooking) {
      await loadServicesForBooking(ucSelectedBooking.booking_id);
    } else {
      ucAvailableServices = [];
      ucCurrentServicesList = [];
      ucSelectedServiceIds = new Set();
      renderServices();
      updateSummary();
    }
  } catch (err) {
    setUseCaseStatus("Failed to load bookings.", true);
  }
}

function renderServices() {
  if (ucCurrentServices) {
    ucCurrentServices.innerHTML = "";
    if (ucCurrentServicesList.length === 0) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = "No services booked yet.";
      ucCurrentServices.appendChild(empty);
    } else {
      ucCurrentServicesList.forEach((service) => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = `${service.description} (${formatMoney(service.costs)})`;
        ucCurrentServices.appendChild(chip);
      });
    }
  }

  if (ucServiceList) {
    ucServiceList.innerHTML = "";
    if (ucAvailableServices.length === 0) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = "No additional services available.";
      ucServiceList.appendChild(empty);
    } else {
      ucAvailableServices.forEach((service) => {
        const label = document.createElement("label");
        label.className = "service-item";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = service.additional_service_id;
        checkbox.checked = ucSelectedServiceIds.has(
          service.additional_service_id
        );
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) {
            ucSelectedServiceIds.add(service.additional_service_id);
          } else {
            ucSelectedServiceIds.delete(service.additional_service_id);
          }
          updateSummary();
        });

        const text = document.createElement("span");
        text.textContent = `${service.description} (${formatMoney(service.costs)})`;
        label.appendChild(checkbox);
        label.appendChild(text);
        ucServiceList.appendChild(label);
      });
    }
  }

  updateSummary();
}

async function loadServicesForBooking(bookingId) {
  if (!bookingId) {
    return;
  }

  try {
    hidePaymentPanel();
    const response = await fetch(
      `/api/usecase/bookings/${encodeURIComponent(bookingId)}/services`
    );
    if (!response.ok) {
      throw new Error("Failed to load services");
    }
    const data = await response.json();
    ucAvailableServices = data.available || [];
    ucCurrentServicesList = data.current || [];
    ucSelectedServiceIds = new Set();
    renderServices();
    setUseCaseStatus("Select additional services to continue.");
  } catch (err) {
    setUseCaseStatus("Failed to load services.", true);
  }
}

function updateSummary() {
  if (!ucSummary) {
    return;
  }

  const baseCost = ucSelectedBooking
    ? Number(ucSelectedBooking.base_cost) || 0
    : 0;
  const existingExtras = ucCurrentServicesList.reduce(
    (sum, service) => sum + (Number(service.costs) || 0),
    0
  );
  const selectedExtras = ucAvailableServices.reduce((sum, service) => {
    if (ucSelectedServiceIds.has(service.additional_service_id)) {
      return sum + (Number(service.costs) || 0);
    }
    return sum;
  }, 0);

  const total = baseCost + existingExtras + selectedExtras;

  ucSummary.innerHTML = `
    <div class="summary-line">
      <span>Base booking cost</span>
      <span>${formatMoney(baseCost)}</span>
    </div>
    <div class="summary-line">
      <span>Already booked services</span>
      <span>${formatMoney(existingExtras)}</span>
    </div>
    <div class="summary-line">
      <span>Selected additional services</span>
      <span>${formatMoney(selectedExtras)}</span>
    </div>
    <div class="summary-line summary-total">
      <span>New total after update</span>
      <span>${formatMoney(total)}</span>
    </div>
  `;

  if (ucConfirmServices) {
    ucConfirmServices.disabled =
      !ucSelectedBooking || ucSelectedServiceIds.size === 0;
  }
}

function hidePaymentPanel() {
  if (ucPaymentPanel) {
    ucPaymentPanel.classList.add("hidden");
  }
}

function showPaymentPanel() {
  if (ucPaymentPanel) {
    ucPaymentPanel.classList.remove("hidden");
  }
}

async function confirmAdditionalServices() {
  if (!ucSelectedCustomer || !ucSelectedBooking) {
    setUseCaseStatus("Select a customer and booking first.", true);
    return;
  }

  const serviceIds = Array.from(ucSelectedServiceIds);
  if (serviceIds.length === 0) {
    setUseCaseStatus("Select at least one additional service.", true);
    return;
  }

  if (ucConfirmPayment) {
    ucConfirmPayment.disabled = true;
  }

  try {
    const response = await fetch(
      `/api/usecase/bookings/${encodeURIComponent(
        ucSelectedBooking.booking_id
      )}/services`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: ucSelectedCustomer.person_id,
          serviceIds,
          confirmPayment: true,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to add services");
    }

    setUseCaseStatus("Additional services booked successfully.");
    hidePaymentPanel();

    const bookingId = ucSelectedBooking.booking_id;
    ucSelectedServiceIds = new Set();
    await loadBookingsForCustomer(bookingId);
    await loadServicesForBooking(bookingId);
  } catch (err) {
    setUseCaseStatus("Failed to book additional services.", true);
  } finally {
    if (ucConfirmPayment) {
      ucConfirmPayment.disabled = false;
    }
  }
}

if (ucCustomerSelect) {
  ucCustomerSelect.addEventListener("change", () => {
    const selectedId = ucCustomerSelect.value;
    ucSelectedCustomer =
      ucCustomers.find((customer) => customer.person_id === selectedId) || null;
    renderCustomerDetails();
    clearUseCaseData();
    loadBookingsForCustomer();
  });
}

if (ucConfirmServices) {
  ucConfirmServices.addEventListener("click", () => {
    if (!ucSelectedBooking || ucSelectedServiceIds.size === 0) {
      setUseCaseStatus("Select services before confirming.", true);
      return;
    }
    showPaymentPanel();
    setUseCaseStatus("Confirm payment to finalize booking.");
  });
}

if (ucConfirmPayment) {
  ucConfirmPayment.addEventListener("click", () => {
    confirmAdditionalServices();
  });
}

if (ucCancelPayment) {
  ucCancelPayment.addEventListener("click", () => {
    hidePaymentPanel();
    setUseCaseStatus("Payment canceled. Adjust services if needed.");
  });
}

loadTables();
loadSeedStatus();
loadUseCaseCustomers();
loadUc1Customers();
