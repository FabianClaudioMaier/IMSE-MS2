export function initUc1Report({ state }) {
  const repFrom = document.getElementById("rep-from");
  const repTo = document.getElementById("rep-to");
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

    for (const row of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" +
        row.booking_id +
        "</td>" +
        "<td>" +
        row.customer_name +
        "</td>" +
        "<td>" +
        row.producer +
        " " +
        row.model +
        "</td>" +
        "<td>" +
        row.start_date +
        " -> " +
        row.end_date +
        "</td>" +
        "<td>" +
        row.days +
        "</td>" +
        "<td>" +
        row.base_cost +
        "</td>" +
        "<td>" +
        row.additional_cost +
        "</td>" +
        "<td><b>" +
        row.total_cost +
        "</b></td>";

      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    repOut.appendChild(table);
  }

  async function loadReport() {
    if (!repOut || !repFrom || !repTo) {
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
      const baseUrl = state.usecase1ApiBase || "/api/usecase1";
      const url =
        `${baseUrl}/report` +
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
}
