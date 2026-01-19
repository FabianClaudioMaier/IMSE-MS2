import { formatMoney } from "./usecase2.js";

export function initUc2Report() {
  const uc2RepFrom = document.getElementById("uc2-rep-from");
  const uc2RepTo = document.getElementById("uc2-rep-to");
  const uc2RepBtn = document.getElementById("uc2-rep-btn");
  const uc2RepStatus = document.getElementById("uc2-rep-status");
  const uc2RepOut = document.getElementById("uc2-rep-out");

  function setUc2RepStatus(text) {
    if (uc2RepStatus) {
      uc2RepStatus.textContent = text || "";
    }
  }

  function formatCell(value) {
    if (value === null || value === undefined) {
      return "";
    }
    return String(value);
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

    for (const row of rows) {
      const services = row.additional_services_list
        ? `${row.additional_services_list} (${row.additional_services_count})`
        : "-";
      const bankAccount = row.customer_iban
        ? `${row.customer_iban} / ${formatCell(row.customer_bic)}`
        : "-";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${formatCell(row.booking_id)}</td>
        <td>${formatCell(row.customer_name)} (${formatCell(row.customer_id)})</td>
        <td>${formatCell(row.retailer_name)} (${formatCell(row.retailer_id)})</td>
        <td>${formatCell(row.producer)} ${formatCell(row.model)} (${formatCell(
        row.vehicle_id
      )})</td>
        <td>${bankAccount}</td>
        <td>${formatCell(row.start_date)} → ${formatCell(row.end_date)}</td>
        <td>${formatCell(row.rental_days)}</td>
        <td>${formatMoney(row.base_cost)}</td>
        <td>${services}</td>
        <td>${formatMoney(row.additional_costs)}</td>
        <td><b>${formatMoney(row.total_cost)}</b></td>
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
}
