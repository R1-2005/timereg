ALTER TABLE Sections ADD COLUMN ShortName TEXT;

UPDATE Sections SET ShortName = 'Teknologi' WHERE Name = 'Seksjon teknologi';
UPDATE Sections SET ShortName = 'Infrastruktur' WHERE Name = 'Infrastruktur og plattform';
UPDATE Sections SET ShortName = 'Personvern' WHERE Name = 'Personvernprogrammet';
