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
const tableHead = tableEl.querySelector("thead");
const tableBody = tableEl.querySelector("tbody");

let currentTable = null;
let currentColumns = [];
let currentRows = [];
const generateLabel = generateButton ? generateButton.textContent : "";

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

function setStatus(message, isError = false) {
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
    rowCount.textContent = "-";
    tableMeta.textContent = "Pick a table to see its rows.";
    return;
  }

  if (query) {
    rowCount.textContent = `${filteredRows.length}/${currentRows.length}`;
    tableMeta.textContent = `Showing ${filteredRows.length} of ${currentRows.length} rows.`;
  } else {
    rowCount.textContent = `${currentRows.length}`;
    tableMeta.textContent = `Showing ${currentRows.length} rows.`;
  }
}

function setActiveButton(tableName) {
  const buttons = tableButtons.querySelectorAll("button");
  buttons.forEach((button) => {
    button.classList.toggle("active", button.dataset.table === tableName);
  });
}

async function loadTable(tableName) {
  const limit = Number.parseInt(limitInput.value, 10) || 50;
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

    tableTitle.textContent = data.table;
    setActiveButton(data.table);
    applyFilter();
    setStatus("Ready.");
  } catch (err) {
    setStatus("Failed to load data.", true);
  }
}

async function loadTables() {
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

    tableCount.textContent = `${data.tables.length}`;
  } catch (err) {
    setStatus("Failed to load table list.", true);
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
  } catch (err) {
    setGenerateState({
      disabled: false,
      label: generateLabel,
      hint: "One-time action. Inserts up to 10 rows per table.",
    });
    setStatus("Failed to generate data.", true);
  }
}

refreshButton.addEventListener("click", () => {
  if (currentTable) {
    loadTable(currentTable);
  }
});

if (generateButton) {
  generateButton.addEventListener("click", () => {
    generateData();
  });
}

limitInput.addEventListener("change", () => {
  if (currentTable) {
    loadTable(currentTable);
  }
});

searchInput.addEventListener("input", () => {
  applyFilter();
});

loadTables();
loadSeedStatus();
