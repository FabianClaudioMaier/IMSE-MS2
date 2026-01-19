const currencyFormatter = new Intl.NumberFormat("de-AT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

export function formatMoney(value) {
  const number = Number(value) || 0;
  return currencyFormatter.format(number);
}

export function initUsecase2({ actions }) {
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
        ucBookingStatus.textContent =
          "No active bookings found for this customer.";
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
          ucBookings.find((booking) => booking.booking_id === keepBookingId) ||
          null;
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
          chip.textContent = `${service.description} (${formatMoney(
            service.costs
          )})`;
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
          text.textContent = `${service.description} (${formatMoney(
            service.costs
          )})`;
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
        ucCustomers.find((customer) => customer.person_id === selectedId) ||
        null;
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

  actions.loadUseCaseCustomers = loadUseCaseCustomers;
  actions.ensureUseCase2Customers = () => {
    if (ucCustomers.length === 0) {
      loadUseCaseCustomers();
    }
  };
  actions.resetUseCase2State = () => {
    ucCustomers = [];
    ucSelectedCustomer = null;
    renderCustomerDetails();
    clearUseCaseData();
  };
}
