-- Fix distribution keys for 70/15/15 projects
-- The 15% that should go to SO Felles (10608, InvoiceProjectId 3) was incorrectly going to SO LO/YS (10607, InvoiceProjectId 2)

-- Update the incorrect distribution keys
-- For projects with 70/15/15 distribution, change the 15% from InvoiceProjectId 2 to InvoiceProjectId 3
UPDATE DistributionKeys
SET InvoiceProjectId = 3
WHERE InvoiceProjectId = 2
  AND Percentage = 15
  AND JiraProjectId IN (
    SELECT Id FROM JiraProjects
    WHERE Key IN ('ANONY', 'BEPO', 'CD', 'DIVN', 'DOK', 'DRIFT', 'EFS', 'GDPRN', 'JCDF', 'JOCM', 'KF', 'MFF', 'MP', 'NA', 'NJLE', 'NOK', 'NTILSLUT21', 'NYTILSLUT', 'NYAAREG', 'SLETST', 'SLPRNY', 'ST', 'AAREGSKDNY', 'P20', 'IO2T2')
  );
