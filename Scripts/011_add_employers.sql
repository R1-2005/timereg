CREATE TABLE Employers (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    OrgNumber TEXT NOT NULL UNIQUE,
    EmailDomain TEXT NOT NULL UNIQUE,
    Address TEXT,
    PostalCode TEXT,
    City TEXT
);

INSERT INTO Employers (Name, OrgNumber, EmailDomain, Address, PostalCode, City)
VALUES ('Proventus AS', '984794452', 'proventus.no', 'Pilestredet 28', '0166', 'OSLO');

ALTER TABLE Consultants ADD COLUMN EmployerId INTEGER REFERENCES Employers(Id);

UPDATE Consultants SET EmployerId = 1;
