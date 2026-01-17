-- Sample data for IMSE-MS2 (one-time generation)
START TRANSACTION;

INSERT INTO Person (id, name, phone_number, eMail, address, stars)
VALUES
  ('p_cust1', 'Alice Example', '0676123456', 'alice@example.com', 'Main Street 1', 4.5),
  ('p_cust2', 'Bob Sunny', '0660123456', 'bob@example.com', 'Sunny Road 3', 4.6),
  ('p_cust3', 'Clara Fast', '0677123987', 'clara@example.com', 'Linden Street 9', 4.4),
  ('p_ret1',  'Blue Cars Ltd.', '0123456789', 'office@bluecars.com', 'Ring Road 2', 4.7),
  ('p_ret2',  'Green Motors', '0133557799', 'office@greenmotors.com', 'Park Avenue 7', 4.8),
  ('p_both1', 'Dana Dual', '0650444555', 'dana@dual.example', 'Harbor Lane 5', 4.3);

INSERT INTO Customer (person_id, customer_number, driver_licencse_number)
VALUES
  ('p_cust1', 'C-1001', 'AB1234567'),
  ('p_cust2', 'C-2002', 'CD7654321'),
  ('p_cust3', 'C-3003', 'EF1112223'),
  ('p_both1', 'C-4004', 'GH9988776');

INSERT INTO Retailer (person_id, company_name, tax_number)
VALUES
  ('p_ret1', 'Blue Cars Ltd.', 'ATU12345678'),
  ('p_ret2', 'Green Motors', 'ATU23456789'),
  ('p_both1', 'Dual Mobility', 'ATU34567890');

INSERT INTO Bankaccount (account_id, iban, bic, person_id)
VALUES
  ('ba1', 'AT611904300234573201', 'BKAUATWW', 'p_cust1'),
  ('ba2', 'AT021100000012345678', 'BKAUATWW', 'p_cust2'),
  ('ba3', 'AT471100000077778888', 'BKAUATWW', 'p_cust3'),
  ('ba4', 'AT180000000000000001', 'BKAUATWW', 'p_ret1'),
  ('ba5', 'AT900000000000000002', 'BKAUATWW', 'p_ret2'),
  ('ba6', 'AT520000000000000003', 'BKAUATWW', 'p_both1');

INSERT INTO Vehicle (vehicle_id, model, producer, costs_per_day, plate_number, number_of_seats, retailer_id)
VALUES
  ('veh1', 'Fiesta', 'Ford', 70.00, 'W-AB123C', 5, 'p_ret1'),
  ('veh2', 'Golf', 'Volkswagen', 80.00, 'W-GR2345', 5, 'p_ret2'),
  ('veh3', 'Yaris', 'Toyota', 60.00, 'W-RT7890', 5, 'p_both1'),
  ('veh4', 'Enyaq', 'Skoda', 95.00, 'W-DN4321', 5, 'p_ret1');

INSERT INTO Booking (booking_id, start_date, end_date, way_of_billing, customer_id, vehicle_id)
VALUES
  ('b1', '2026-01-05', '2026-01-10', 'CreditCard', 'p_cust1', 'veh1'),
  ('b2', '2026-02-01', '2026-02-03', 'Invoice', 'p_cust2', 'veh2'),
  ('b3', '2026-03-10', '2026-03-15', 'PayPal', 'p_cust3', 'veh3'),
  ('b4', '2026-04-05', '2026-04-07', 'CreditCard', 'p_both1', 'veh4'),
  ('b5', '2026-05-12', '2026-05-18', 'CreditCard', 'p_cust1', 'veh3');

INSERT INTO AdditionalService (additional_service_id, description, costs)
VALUES
  ('as1', 'ChildSeat', 20.00),
  ('as2', 'ExtraDriver', 30.00),
  ('as3', 'Navigation', 15.00),
  ('as4', 'FullInsurance', 50.00),
  ('as5', 'WinterTires', 25.00);

INSERT INTO Bookings_Services (booking_id, additional_service_id)
VALUES
  ('b1', 'as1'),
  ('b1', 'as4'),
  ('b2', 'as3'),
  ('b3', 'as2'),
  ('b3', 'as5'),
  ('b4', 'as4'),
  ('b5', 'as1'),
  ('b5', 'as3');

INSERT INTO Rating (rater_id, rated_id, stars)
VALUES
  ('p_cust1', 'p_ret1', 4.8),
  ('p_ret1', 'p_cust1', 4.2),
  ('p_cust2', 'p_ret2', 4.6),
  ('p_ret2', 'p_cust2', 4.5),
  ('p_cust3', 'p_both1', 4.1),
  ('p_both1', 'p_cust3', 4.7);

COMMIT;
