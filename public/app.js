const viewButtons = document.querySelectorAll("[data-view]");
const views = {
  home: document.getElementById("view-home"),
  usecase1: document.getElementById("view-usecase1"),
  usecase2: document.getElementById("view-usecase2"),
  explore: document.getElementById("view-explore"),
  "uc1-report": document.getElementById("view-uc1-report"),
  "uc2-report": document.getElementById("view-uc2-report"),
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
  if (viewName === "usecase1" && !uc1CustomersLoaded) {
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
const migrateButton = document.getElementById("migrate-nosql");
const migrateHint = document.getElementById("migrate-hint");
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
async function migrateNoSql() {
  if (!migrateButton) return;
  migrateButton.disabled = true;
  setStatus("Migrating to NoSQL...");
  try {
    const res = await fetch("/api/migrate-nosql", { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Migration failed");
    setStatus("Migration complete.");
  } catch (err) {
    setStatus("Migration failed.", true);
  } finally {
    migrateButton.disabled = false;
  }
}

if (migrateButton) {
  migrateButton.addEventListener("click", migrateNoSql);
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












//  Use Case 1 

let uc1CustomersLoaded = false;
let uc1DefaultCustomerId = null;

// Elemente holen (passen zu index.html)
const customerSelect = document.getElementById("uc1-customer");
const startInput = document.getElementById("uc1-start");
const endInput = document.getElementById("uc1-end");
const searchBtn = document.getElementById("uc1-search");
const statusP = document.getElementById("uc1-status");
const vehiclesDiv = document.getElementById("uc1-vehicles");
const summaryDiv = document.getElementById("uc1-result");

function setUc1Status(text) {
  if (statusP) {
    statusP.textContent = text || "";
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
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}


//USECASE!




//


// 1) Customers laden
async function loadUc1Customers() {
  try {
    setUc1Status("Loading customers...");
    const data = await getJson("/api/usecase1/customers");

    if(data.customers && data.customers.length>0){
      uc1DefaultCustomerId= data.customers[0].person_id;
    } else{
      uc1DefaultCustomerId= null;
    }

    if (customerSelect) {


      customerSelect.innerHTML = "";
      for (const customer of data.customers) {


        const opt = document.createElement("option");
        opt.value = customer.person_id; // interne ID
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








// 2) Fahrzeuge suchen
async function searchVehicles(options = {}) {


  const { preserveStatus = false } = options;


  if (vehiclesDiv) {
    vehiclesDiv.innerHTML = "";
  }
  if (!preserveStatus) {
    setSummary("");
  }


  let start, end, customerId;

  if(startInput!=null){
     start= startInput.value;
  }
  else{
     start="";
  }
 

  if(endInput!=null){
     end= endInput.value;
  }
  else{
     end="";
  }

  if(customerSelect!=null){
    customerId= customerSelect.value;
  }
  else{
    customerId= uc1DefaultCustomerId;
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
      `/api/usecase1/vehicles?start=${start}&end=${end}`
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

    for (const v of data.vehicles) {
      const row = document.createElement("div");


      row.textContent = `${v.producer} ${v.model} | ${v.plate_number} | €${v.costs_per_day}/day`;

      const but = document.createElement("button");
      but.textContent = "Reserve";




      but.onclick = () => reserveVehicle(v.vehicle_id, start, end, customerId);

      row.appendChild(but);



      if(vehiclesDiv!=null){
        vehiclesDiv.appendChild(row);
      }

      
    }
  } catch (e) {
    setUc1Status("Error: " + e.message);
  }
}






// 3) Reservieren
async function reserveVehicle(vehicleId, startDate, endDate, customerId) {



  try {
    setUc1Status("Creating reservation...");

    const daten = {
      customerId: customerId,
      vehicleId: vehicleId,
      startDate: startDate,
      endDate: endDate,
      wayOfBilling: "BANK_TRANSFER",
    };

    const data = await postJson("/api/usecase1/bookings", daten);

    setUc1Status("Reservation created!");
    setSummary(data);

    await searchVehicles({ preserveStatus: true });
  } catch (e) {
    setUc1Status("Error: " + e.message);
  }
}

if (searchBtn) {
  searchBtn.addEventListener("click", searchVehicles);
}

loadUc1Customers();





//-------------------------------------------------------------------



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


















// ===== Analytics Report (Use Case Student 1) =====

const repFrom = document.getElementById("rep-from");
const repTo = document.getElementById("rep-to");
const repVehicle = document.getElementById("rep-vehicle");
const repBtn = document.getElementById("rep-btn");
const repStatus = document.getElementById("rep-status");
const repOut = document.getElementById("rep-out");

function setRepStatus(text) {
  if (repStatus) {
    repStatus.textContent = text || "";
  }
}

function renderReport(rows) {
  if (!repOut) {
    return;
  }
  repOut.innerHTML = "";

  if (!rows || rows.length === 0) {
    repOut.textContent = "No bookings found.";
    return;
  }

  const table = document.createElement("table");
  table.border = "1";
  table.cellPadding = "6";

  table.innerHTML = `
    <thead>
      <tr>
        <th>Booking</th>
        <th>Customer</th>
        <th>Vehicle</th>
        <th>Period</th>
        <th>Days</th>
        <th>Base cost</th>
        <th>Additional</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");

  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.booking_id}</td>
      <td>${r.customer_name}</td>
      <td>${r.producer} ${r.model}</td>
      <td>${r.start_date} → ${r.end_date}</td>
      <td>${r.days}</td>
      <td>${r.base_cost}</td>
      <td>${r.additional_cost}</td>
      <td><b>${r.total_cost}</b></td>
    `;
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  repOut.appendChild(table);
}

async function loadReport() {
  if (!repOut || !repFrom || !repTo || !repVehicle) {
    return;
  }
  try {


    setRepStatus("Loading report...");
    repOut.innerHTML = "";

    const params = new URLSearchParams();
    if (repFrom.value) {
      params.set("from", repFrom.value);
    }
    if (repTo.value) {
      params.set("to", repTo.value);
    }
    if (repVehicle.value){ 
      params.set("vehicleId", repVehicle.value.trim());
    }

    const url =
      "/api/usecase1/report" +
      (params.toString() ? "?" + params.toString() : "");

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      setRepStatus(data.error || "Error loading report");
      return;
    }

    setRepStatus("");
    renderReport(data.report);
  } catch (err) {
    setRepStatus("Error: " + err.message);
  }
}

if (repBtn) {
  repBtn.addEventListener("click", loadReport);
}


// ===== Analytics Report (Use Case Student 2) =====

const uc2RepFrom = document.getElementById("uc2-rep-from");
const uc2RepTo = document.getElementById("uc2-rep-to");
const uc2RepCustomer = document.getElementById("uc2-rep-customer");
const uc2RepRetailer = document.getElementById("uc2-rep-retailer");
const uc2RepBtn = document.getElementById("uc2-rep-btn");
const uc2RepStatus = document.getElementById("uc2-rep-status");
const uc2RepOut = document.getElementById("uc2-rep-out");

function setUc2RepStatus(text) {
  if (uc2RepStatus) {
    uc2RepStatus.textContent = text || "";
  }
}

function renderUc2Report(rows) {
  if (!uc2RepOut) {
    return;
  }
  uc2RepOut.innerHTML = "";

  if (!rows || rows.length === 0) {
    uc2RepOut.textContent = "No bookings with additional services found.";
    return;
  }

  const table = document.createElement("table");
  table.border = "1";
  table.cellPadding = "6";

  table.innerHTML = `
    <thead>
      <tr>
        <th>Booking</th>
        <th>Customer</th>
        <th>Retailer</th>
        <th>Vehicle</th>
        <th>Bank account</th>
        <th>Period</th>
        <th>Days</th>
        <th>Base cost</th>
        <th>Additional services</th>
        <th>Additional cost</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");

  for (const r of rows) {
    const services = r.additional_services_list
      ? `${r.additional_services_list} (${r.additional_services_count})`
      : "-";
    const bankAccount = r.customer_iban
      ? `${r.customer_iban} / ${formatCell(r.customer_bic)}`
      : "-";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatCell(r.booking_id)}</td>
      <td>${formatCell(r.customer_name)} (${formatCell(r.customer_id)})</td>
      <td>${formatCell(r.retailer_name)} (${formatCell(r.retailer_id)})</td>
      <td>${formatCell(r.producer)} ${formatCell(r.model)} (${formatCell(
      r.vehicle_id
    )})</td>
      <td>${bankAccount}</td>
      <td>${formatCell(r.start_date)} → ${formatCell(r.end_date)}</td>
      <td>${formatCell(r.rental_days)}</td>
      <td>${formatMoney(r.base_cost)}</td>
      <td>${services}</td>
      <td>${formatMoney(r.additional_costs)}</td>
      <td><b>${formatMoney(r.total_cost)}</b></td>
    `;
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  uc2RepOut.appendChild(table);
}

async function loadUc2Report() {
  if (!uc2RepOut || !uc2RepFrom || !uc2RepTo) {
    return;
  }

  try {
    setUc2RepStatus("Loading report...");
    uc2RepOut.innerHTML = "";

    const params = new URLSearchParams();
    if (uc2RepFrom.value) {
      params.set("from", uc2RepFrom.value);
    }
    if (uc2RepTo.value) {
      params.set("to", uc2RepTo.value);
    }
    if (uc2RepCustomer && uc2RepCustomer.value.trim()) {
      params.set("customerId", uc2RepCustomer.value.trim());
    }
    if (uc2RepRetailer && uc2RepRetailer.value.trim()) {
      params.set("retailerId", uc2RepRetailer.value.trim());
    }

    const url =
      "/api/usecase2/report" +
      (params.toString() ? "?" + params.toString() : "");

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      setUc2RepStatus(data.error || "Error loading report");
      return;
    }

    setUc2RepStatus("");
    renderUc2Report(data.report);
  } catch (err) {
    setUc2RepStatus("Error: " + err.message);
  }
}

if (uc2RepBtn) {
  uc2RepBtn.addEventListener("click", loadUc2Report);
}
