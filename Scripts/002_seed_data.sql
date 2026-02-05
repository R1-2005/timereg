-- Seed invoice projects
INSERT INTO InvoiceProjects (ProjectNumber, Name) VALUES ('10108', 'AFP Systemutvikling');
INSERT INTO InvoiceProjects (ProjectNumber, Name) VALUES ('10607', 'Sliterordningen LO/YS');
INSERT INTO InvoiceProjects (ProjectNumber, Name) VALUES ('10608', 'Sliterordningen Felles');
INSERT INTO InvoiceProjects (ProjectNumber, Name) VALUES ('11003', 'OU Samordningen');

-- Seed Jira projects
-- Løpende AFP (100% -> 10108)
INSERT INTO JiraProjects (Key, Name) VALUES ('AFPSAK', 'AFP saksbehandling, løpende endringer');
INSERT INTO JiraProjects (Key, Name) VALUES ('AT24', 'Oppdatert AFP søknadsskjema, fjerne AG-skjema');
INSERT INTO JiraProjects (Key, Name) VALUES ('NYAFPFAKT', 'AFP fakturering, løpende endringer');
INSERT INTO JiraProjects (Key, Name) VALUES ('OAFPT', 'Offentlig AFP teknisk utvikling');
INSERT INTO JiraProjects (Key, Name) VALUES ('DOFA', 'Drift Offentlig AFP');

-- 70/15/15 AFP/SO/OUS (70% -> 10108, 15% -> 10607, 15% -> 11003)
INSERT INTO JiraProjects (Key, Name) VALUES ('ANONY', 'Anonymisering');
INSERT INTO JiraProjects (Key, Name) VALUES ('BEPO', 'Bedriftsportalen løpende endringer');
INSERT INTO JiraProjects (Key, Name) VALUES ('CD', 'Dokumentgodkjenning Confluence og Jira');
INSERT INTO JiraProjects (Key, Name) VALUES ('DIVN', 'Diverse Endringer');
INSERT INTO JiraProjects (Key, Name) VALUES ('DOK', 'Dokumentasjon');
INSERT INTO JiraProjects (Key, Name) VALUES ('DRIFT', 'Driftssaker');
INSERT INTO JiraProjects (Key, Name) VALUES ('EFS', 'Etablering sikker utvikling');
INSERT INTO JiraProjects (Key, Name) VALUES ('GDPRN', 'GDPR løpende endringer');
INSERT INTO JiraProjects (Key, Name) VALUES ('JCDF', 'Sky Confluence og Jira drift og feilmeldingsaker løpende');
INSERT INTO JiraProjects (Key, Name) VALUES ('JOCM', 'Jira og Confluence migrering');
INSERT INTO JiraProjects (Key, Name) VALUES ('KF', 'Kvartalsfakturering felles');
INSERT INTO JiraProjects (Key, Name) VALUES ('MFF', 'Månedsfaktuering felles');
INSERT INTO JiraProjects (Key, Name) VALUES ('MP', 'Meldingsportalen');
INSERT INTO JiraProjects (Key, Name) VALUES ('NA', 'Nytt NAV API - midlertidig løsning');
INSERT INTO JiraProjects (Key, Name) VALUES ('NJLE', 'Journal/editor/PDF, løpende endringer');
INSERT INTO JiraProjects (Key, Name) VALUES ('NOK', 'Økonomi / Visma, løpende endringer');
INSERT INTO JiraProjects (Key, Name) VALUES ('NTILSLUT21', 'Tilslutning endret hovednøkkel');
INSERT INTO JiraProjects (Key, Name) VALUES ('NYTILSLUT', 'Tilslutning løpende endringer');
INSERT INTO JiraProjects (Key, Name) VALUES ('NYAAREG', 'AAREG Løpende endringer');
INSERT INTO JiraProjects (Key, Name) VALUES ('SLETST', 'Sletteprosjekt testing');
INSERT INTO JiraProjects (Key, Name) VALUES ('SLPRNY', 'Sletting Proventus');
INSERT INTO JiraProjects (Key, Name) VALUES ('ST', 'Snudd Tilslutning');
INSERT INTO JiraProjects (Key, Name) VALUES ('AAREGSKDNY', 'AAREGSKD Omlegging av import av aareg og SKD');
INSERT INTO JiraProjects (Key, Name) VALUES ('P20', 'Personvernprosjekt 2.0');
INSERT INTO JiraProjects (Key, Name) VALUES ('IO2T2', 'Infrastrukturoppgradering');

-- 75/25 AFP/SO Felles (75% -> 10108, 25% -> 10608)
INSERT INTO JiraProjects (Key, Name) VALUES ('NYMINSIDE', 'MINSIDE');
INSERT INTO JiraProjects (Key, Name) VALUES ('NYSKD', 'SKD-overføringer, løpende endringer');
INSERT INTO JiraProjects (Key, Name) VALUES ('IOP', 'Infrastruktur og planlegging');

-- Løpende SO, kun LO/YS (100% -> 10607)
INSERT INTO JiraProjects (Key, Name) VALUES ('NYSOFAKT', 'SO Fakturering');

-- Løpende SO felles (100% -> 10608)
INSERT INTO JiraProjects (Key, Name) VALUES ('NYSOSAK', 'SO Saksbehandling');
INSERT INTO JiraProjects (Key, Name) VALUES ('NYSOUTBET', 'SO Utbetaling løpende endringer');

-- Løpende OUS (100% -> 11003)
INSERT INTO JiraProjects (Key, Name) VALUES ('OU2021N', 'OU nyutvikling, fakturering og vasking');
INSERT INTO JiraProjects (Key, Name) VALUES ('OUFAKTNY', 'OU fakturering, løpende endringer');
INSERT INTO JiraProjects (Key, Name) VALUES ('OUVASK', 'OU vask, løpende endringer');

-- Distribution Keys
-- Løpende AFP: 100% -> 10108 (InvoiceProject Id 1)
INSERT INTO DistributionKeys (JiraProjectId, InvoiceProjectId, Percentage)
SELECT jp.Id, 1, 100 FROM JiraProjects jp WHERE jp.Key IN ('AFPSAK', 'AT24', 'NYAFPFAKT', 'OAFPT', 'DOFA');

-- 70/15/15: 70% -> 10108, 15% -> 10607, 15% -> 11003
INSERT INTO DistributionKeys (JiraProjectId, InvoiceProjectId, Percentage)
SELECT jp.Id, 1, 70 FROM JiraProjects jp WHERE jp.Key IN ('ANONY', 'BEPO', 'CD', 'DIVN', 'DOK', 'DRIFT', 'EFS', 'GDPRN', 'JCDF', 'JOCM', 'KF', 'MFF', 'MP', 'NA', 'NJLE', 'NOK', 'NTILSLUT21', 'NYTILSLUT', 'NYAAREG', 'SLETST', 'SLPRNY', 'ST', 'AAREGSKDNY', 'P20', 'IO2T2');

INSERT INTO DistributionKeys (JiraProjectId, InvoiceProjectId, Percentage)
SELECT jp.Id, 2, 15 FROM JiraProjects jp WHERE jp.Key IN ('ANONY', 'BEPO', 'CD', 'DIVN', 'DOK', 'DRIFT', 'EFS', 'GDPRN', 'JCDF', 'JOCM', 'KF', 'MFF', 'MP', 'NA', 'NJLE', 'NOK', 'NTILSLUT21', 'NYTILSLUT', 'NYAAREG', 'SLETST', 'SLPRNY', 'ST', 'AAREGSKDNY', 'P20', 'IO2T2');

INSERT INTO DistributionKeys (JiraProjectId, InvoiceProjectId, Percentage)
SELECT jp.Id, 4, 15 FROM JiraProjects jp WHERE jp.Key IN ('ANONY', 'BEPO', 'CD', 'DIVN', 'DOK', 'DRIFT', 'EFS', 'GDPRN', 'JCDF', 'JOCM', 'KF', 'MFF', 'MP', 'NA', 'NJLE', 'NOK', 'NTILSLUT21', 'NYTILSLUT', 'NYAAREG', 'SLETST', 'SLPRNY', 'ST', 'AAREGSKDNY', 'P20', 'IO2T2');

-- 75/25 AFP/SO Felles: 75% -> 10108, 25% -> 10608
INSERT INTO DistributionKeys (JiraProjectId, InvoiceProjectId, Percentage)
SELECT jp.Id, 1, 75 FROM JiraProjects jp WHERE jp.Key IN ('NYMINSIDE', 'NYSKD', 'IOP');

INSERT INTO DistributionKeys (JiraProjectId, InvoiceProjectId, Percentage)
SELECT jp.Id, 3, 25 FROM JiraProjects jp WHERE jp.Key IN ('NYMINSIDE', 'NYSKD', 'IOP');

-- Løpende SO kun LO/YS: 100% -> 10607
INSERT INTO DistributionKeys (JiraProjectId, InvoiceProjectId, Percentage)
SELECT jp.Id, 2, 100 FROM JiraProjects jp WHERE jp.Key = 'NYSOFAKT';

-- Løpende SO felles: 100% -> 10608
INSERT INTO DistributionKeys (JiraProjectId, InvoiceProjectId, Percentage)
SELECT jp.Id, 3, 100 FROM JiraProjects jp WHERE jp.Key IN ('NYSOSAK', 'NYSOUTBET');

-- Løpende OUS: 100% -> 11003
INSERT INTO DistributionKeys (JiraProjectId, InvoiceProjectId, Percentage)
SELECT jp.Id, 4, 100 FROM JiraProjects jp WHERE jp.Key IN ('OU2021N', 'OUFAKTNY', 'OUVASK')
