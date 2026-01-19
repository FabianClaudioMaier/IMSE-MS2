-- Zeitraum
SET @from = '2025-11-01';
SET @to   = '2026-01-31';

-- Optional: nach Kunde/Anbieter filtern
-- SET @customer_id  = 'p_cust1';
-- SET @retailer_id  = 'p_anb1';


SELECT
  b.booking_id,
  b.start_date,
  b.end_date,

  c.person_id              AS customer_id,
  pc.name                  AS customer_name,

  v.vehicle_id,
  v.model,
  v.producer,

  r.person_id              AS retailer_id,
  r.company_name           AS retailer_name,

  -- Mietdauer (min. 1 Tag)
  GREATEST(DATEDIFF(b.end_date, b.start_date), 1)                           AS rental_days,
  v.costs_per_day                                                            AS cost_per_day,
  GREATEST(DATEDIFF(b.end_date, b.start_date), 1) * v.costs_per_day         AS base_cost,

  COALESCE(SUM(asv.costs), 0)                                               AS additional_costs,
  COUNT(bs.additional_service_id)                                           AS additional_services_count,

  -- Gesamtkosten transparent
  (GREATEST(DATEDIFF(b.end_date, b.start_date), 1) * v.costs_per_day)
    + COALESCE(SUM(asv.costs), 0)                                           AS total_cost,

  -- Lesbare Liste der Services
  GROUP_CONCAT(asv.description ORDER BY asv.description SEPARATOR ', ')     AS additional_services_list

FROM Booking b
JOIN Customer  c  ON c.person_id   = b.customer_id
JOIN Person    pc ON pc.id         = c.person_id
JOIN Vehicle   v  ON v.vehicle_id  = b.vehicle_id
JOIN Retailer  r  ON r.person_id   = v.retailer_id
LEFT JOIN Bookings_Services bs ON bs.booking_id = b.booking_id
LEFT JOIN AdditionalService asv ON asv.additional_service_id = bs.additional_service_id

WHERE b.start_date >= @from
  AND b.start_date <  @to
  -- optionale Filter:
  -- AND c.person_id = @customer_id
  -- AND r.person_id = @retailer_id

GROUP BY
  b.booking_id, b.start_date, b.end_date,
  c.person_id, pc.name,
  v.vehicle_id, v.model, v.producer,
  r.person_id, r.company_name,
  v.costs_per_day

ORDER BY b.start_date;
