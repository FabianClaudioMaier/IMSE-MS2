
create TABLE Person(
id varchar(20) PRIMARY Key,
name varChar(20),
phone_number varChar(100),
eMail varchar(100),
address varchar(150),
stars double CHECK ( stars BETWEEN 0 And 5)
);


-- rater_id(pk, fk), rated_id(pk,fk), stars
create Table Rating
(
    rater_id    varchar(20) not null,
    rated_id varchar(20) not null,
    stars         double CHECK ( stars BETWEEN 0 And 5),
    primary key (rater_id, rated_id),
    foreign key (rater_id) references Person (id) on delete CASCADE,
    foreign key (rated_id) references Person (id) on delete cascade
);

--persond_id(PK, FK), Customernummer, driver_licencse_number
Create Table Customer(
  person_id varchar(20) PRIMARY KEY,
  customer_number varchar(20) UNIQUE ,
  driver_licencse_number varchar(20) UNIQUE ,
  FOREIGN KEy (person_id) REFERENCES Person(id) on DELETE CASCADE
  );

--person_id(PK,FK) company_name, tax_number
CREATE Table Retailer(
	person_id varchar(20) PRIMARY Key,
    company_name varchar(20),
    tax_number varchar(20) UNIQUE ,
    FOREIGN Key(person_id) REFERENCES Person(id) on DELETE CASCADE
);

--acoount_id(PK), iban, bic, person_id(fk)
create Table Bankaccount(
	account_id varchar(20) PRIMARY KEY,
  	iban varchar(20) Unique,
  	bic varchar(20),
 	person_id varchar(20) NOT NULL UNIQUE ,
  	FOREIGN KEY (person_id) REFERENCES Person(id) ON DELETE CASCADE
    );

--vehicle_id(pk), model, producer, costs_per_day, plate_number, baujah, retailer_id(fk)
CREATE TABLE Vehicle (
  vehicle_id varchar(20) PRIMARY KEY,
  model varchar(20),
  producer  varchar(20),
  costs_per_day DECIMAL(10,2),
  plate_number varchar(20) unique ,
  number_of_seats INTEGER,
  retailer_id varchar(20),
  FOREIGN KEY (retailer_id) REFERENCES Retailer(person_id) ON DELETE CASCADE
);

--booking_id(pk), start, ende, gesamt_costs, way_of_billing, customer_id(fk), vehicle_id(fk)

--dateformat= YYYY-MM-DD
CREATE TABLE Booking (
  booking_id varchar(20) PRIMARY KEY,
  start_date DATE not null ,
  end_date Date not null,
  total_costs DECIMAL(10,2),
  way_of_billing varchar(20),
  customer_id varchar(20),
  vehicle_id varchar(20),
  FOREIGN KEY (customer_id) REFERENCES Customer(person_id) ON DELETE CASCADE,
  FOREIGN KEY (vehicle_id) REFERENCES Vehicle(vehicle_id) ON DELETE CASCADE
);

-- leistungs_id(pk), beschreibzng, costs, booking_id(pk, fk)
CREATE TABLE AdditionalService (
  additional_service_id varchar(20) PRIMARY KEY ,
  description varchar(20),
  costs  DECIMAL(10,2)
);

--booking_id(pk,fk), AdditionalServices_id(pk,fk)
Create Table Bookings_Services(
    booking_id varchar(20),
    additional_service_id varchar(20),
    PRIMARY KEY (booking_id, additional_service_id),
    foreign key (booking_id) references Booking(booking_id) on delete CASCADE ,
    foreign key (additional_service_id) references AdditionalService(additional_service_id) on delete CASCADE
);
