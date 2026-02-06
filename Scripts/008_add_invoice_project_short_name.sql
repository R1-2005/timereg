ALTER TABLE InvoiceProjects ADD COLUMN ShortName TEXT;

UPDATE InvoiceProjects SET ShortName = '10108 AFP' WHERE ProjectNumber = '10108';
UPDATE InvoiceProjects SET ShortName = '10607 SO LO/YS' WHERE ProjectNumber = '10607';
UPDATE InvoiceProjects SET ShortName = '10608 SO Felles' WHERE ProjectNumber = '10608';
UPDATE InvoiceProjects SET ShortName = '11003 OUS' WHERE ProjectNumber = '11003';
