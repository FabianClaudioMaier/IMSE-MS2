export function initExplorer({ actions }) {
  const tableButtons = document.getElementById("table-buttons");
  const limitInput = document.getElementById("limit");
  const searchInput = document.getElementById("search");
  const refreshButton = document.getElementById("refresh");
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
            String(value ?? "")
              .toLowerCase()
              .includes(query)
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

  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      if (currentTable) {
        loadTable(currentTable);
      }
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

  actions.setStatus = setStatus;
  actions.loadTable = loadTable;
  actions.loadTables = loadTables;
  actions.getCurrentTable = () => currentTable;
}
