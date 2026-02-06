ALTER TABLE Consultants ADD COLUMN IsAdmin INTEGER NOT NULL DEFAULT 0;
ALTER TABLE Consultants ADD COLUMN EmployedFrom TEXT;
ALTER TABLE Consultants ADD COLUMN EmployedTo TEXT;

UPDATE Consultants SET EmployedFrom = '2015-01-01';

UPDATE Consultants SET IsAdmin = 1
