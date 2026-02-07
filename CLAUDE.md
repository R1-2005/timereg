# CLAUDE.md — Timeregistreringssystem

## Prosjektoversikt

Internt timeregistreringssystem for konsulenter (~5 brukere). Timer registreres per Jira-sak og fordeles automatisk på fakturaprosjekter og seksjoner via konfigurerbare fordelingsnøkler. Systemet genererer månedlige faktureringsgrunnlag.

## Teknologistakk

- **Backend:** .NET 10 (C#), minimal API i `Program.cs`
- **Frontend:** Vue 3 via CDN (ingen byggsteg, ingen npm/node)
- **Database:** SQLite via Dapper
- **Excel-eksport:** ClosedXML
- **PDF-eksport:** QuestPDF
- **Produksjon:** IIS på Windows Server
- **Utvikling:** Crostini Linux (Chromebook) og Windows

## Kjøring

```bash
dotnet run          # Utvikling
dotnet publish -c Release  # Produksjon
```

## Viktige arkitekturbeslutninger

- **Frontend uten byggsteg:** Vue 3 lastes via CDN. Ingen .vue-filer, ingen Vite, ingen npm. Komponenter er JS-objekter med inline templates i `wwwroot/js/components/`.
- **Enkelt .NET-prosjekt:** Serverer både API og statiske filer. Ingen separate prosjekter.
- **SQLite som eneste datalager:** Filen `timeregistrering.db` lever i prosjektmappen. Skjemaendringer via nummererte SQL-skript i `Scripts/`.
- **Automatisk migrering:** `DatabaseInitializer` kjører uappliserte skript ved oppstart, sporet i `__migrations`-tabellen.

## Utviklingsregler

### Git
- Ikke kjør `git commit` eller `git push` automatisk — vent til brukeren ber om det

### Kodekonvensjoner
- C#: standard .NET-konvensjoner
- JavaScript: moderne ES6+ med Vue 3 Options API
- API: alle endepunkter returnerer JSON
- Datoer: ISO 8601 i API, `dd.MM`/`dd.MM.yyyy` i frontend
- Timer: aksepteres som `h:mm`, desimal med komma (`1,5`) eller punktum (`1.5`). Lagres som desimaltall

## Databaseskjema

### Employers
| Kolonne | Type | Constraint |
|---------|------|------------|
| Id | INTEGER | PK AUTOINCREMENT |
| Name | TEXT NOT NULL | |
| OrgNumber | TEXT NOT NULL | UNIQUE |
| EmailDomain | TEXT NOT NULL | UNIQUE |
| Address | TEXT | |
| PostalCode | TEXT | |
| City | TEXT | |

Seed: Proventus AS (984794452, proventus.no, Pilestredet 28, 0166, OSLO)

### Consultants
| Kolonne | Type | Constraint |
|---------|------|------------|
| Id | INTEGER | PK AUTOINCREMENT |
| FirstName | TEXT NOT NULL | |
| LastName | TEXT NOT NULL | |
| Email | TEXT NOT NULL | UNIQUE |
| IsAdmin | INTEGER NOT NULL | DEFAULT 0 |
| CanRegisterHours | INTEGER NOT NULL | DEFAULT 1 |
| IsActive | INTEGER NOT NULL | DEFAULT 1 |
| EmployedFrom | TEXT | yyyy-MM-dd, alltid 1. i mnd |
| EmployedTo | TEXT | yyyy-MM-dd, alltid siste i mnd. null = aktiv |
| EmployerId | INTEGER | FK → Employers(Id) |

### InvoiceProjects
| Kolonne | Type | Constraint |
|---------|------|------------|
| Id | INTEGER | PK AUTOINCREMENT |
| ProjectNumber | TEXT NOT NULL | UNIQUE |
| Name | TEXT NOT NULL | |
| ShortName | TEXT | Kort visningsnavn for tabelloversk. etc. |

Seed: 10108 AFP Systemutvikling (ShortName: "10108 AFP"), 10607 Sliterordningen LO/YS ("10607 SO LO/YS"), 10608 Sliterordningen Felles ("10608 SO Felles"), 11003 OU Samordningen ("11003 OUS")

### JiraProjects
| Kolonne | Type | Constraint |
|---------|------|------------|
| Id | INTEGER | PK AUTOINCREMENT |
| Key | TEXT NOT NULL | UNIQUE (Jira-prefiks, f.eks. "AFP") |
| Name | TEXT NOT NULL | |

### DistributionKeys
| Kolonne | Type | Constraint |
|---------|------|------------|
| Id | INTEGER | PK AUTOINCREMENT |
| JiraProjectId | INTEGER NOT NULL | FK → JiraProjects ON DELETE CASCADE |
| InvoiceProjectId | INTEGER NOT NULL | FK → InvoiceProjects ON DELETE RESTRICT |
| Percentage | REAL NOT NULL | |

UNIQUE(JiraProjectId, InvoiceProjectId). Sum per JiraProject skal alltid være 100%.

### Sections
| Kolonne | Type | Constraint |
|---------|------|------------|
| Id | INTEGER | PK AUTOINCREMENT |
| Name | TEXT NOT NULL | UNIQUE |
| ShortName | TEXT | Kort visningsnavn |

Seed: "Seksjon teknologi" (ShortName: "Teknologi"), "Infrastruktur og plattform" ("Infrastruktur"), "Personvernprogrammet" ("Personvern")

### SectionDistributionKeys
| Kolonne | Type | Constraint |
|---------|------|------------|
| Id | INTEGER | PK AUTOINCREMENT |
| JiraProjectId | INTEGER NOT NULL | FK → JiraProjects ON DELETE CASCADE |
| SectionId | INTEGER NOT NULL | FK → Sections ON DELETE RESTRICT |
| Percentage | REAL NOT NULL | |

UNIQUE(JiraProjectId, SectionId). Sum per JiraProject skal alltid være 100%.

### TimeEntries
| Kolonne | Type | Constraint |
|---------|------|------------|
| Id | INTEGER | PK AUTOINCREMENT |
| ConsultantId | INTEGER NOT NULL | FK → Consultants ON DELETE CASCADE |
| JiraIssueKey | TEXT NOT NULL | Full saksnøkkel, f.eks. "AFP-123" |
| JiraProjectId | INTEGER NOT NULL | FK → JiraProjects ON DELETE RESTRICT |
| Date | TEXT NOT NULL | yyyy-MM-dd |
| Hours | REAL NOT NULL | |

UNIQUE(ConsultantId, JiraIssueKey, Date)

### MonthlyLocks
| Kolonne | Type | Constraint |
|---------|------|------------|
| Id | INTEGER | PK AUTOINCREMENT |
| ConsultantId | INTEGER NOT NULL | FK → Consultants ON DELETE CASCADE |
| Year | INTEGER NOT NULL | |
| Month | INTEGER NOT NULL | |
| LockedAt | TEXT NOT NULL | ISO 8601 tidsstempel |

UNIQUE(ConsultantId, Year, Month). Når en rad finnes er måneden markert som ferdig og skrivebeskyttet.

## API-endepunkter

### Innlogging
- `POST /api/login` ← `{ firstName, email }` → `Consultant` eller 401. E-postdomenet må matche en registrert arbeidsgiver. Deaktiverte brukere (IsActive=false) avvises med 400.

### Arbeidsgivere
- `GET /api/employers` → `Employer[]`
- `GET /api/employers/{id}` → `Employer`
- `POST /api/employers` ← `Employer` (validerer: OrgNumber 9 siffer, EmailDomain påkrevd)
- `PUT /api/employers/{id}` ← `Employer`
- `GET /api/employers/with-consultants` → `int[]` (arbeidsgiver-IDer som har konsulenter)
- `DELETE /api/employers/{id}` — avviser med 400 hvis arbeidsgiveren har konsulenter

### Konsulenter
- `GET /api/consultants` → `Consultant[]` (inkl. EmployerName via JOIN)
- `GET /api/consultants/{id}` → `Consultant`
- `POST /api/consultants` ← `Consultant` (validerer e-postdomene mot valgt arbeidsgiver)
- `PUT /api/consultants/{id}` ← `Consultant`
- `GET /api/consultants/with-time-entries` → `int[]` (konsulent-IDer som har timeregistreringer)
- `DELETE /api/consultants/{id}` — avviser med 400 hvis konsulenten har timeregistreringer

### Fakturaprosjekter
- `GET /api/invoice-projects` → `InvoiceProject[]`

### Seksjoner
- `GET /api/sections` → `Section[]`

### Jira-prosjekter
- `GET /api/jira-projects` → `JiraProjectDto[]` (inkl. distributionKeys + sectionDistributionKeys)
- `GET /api/jira-projects/{id}` → `JiraProjectDto`
- `POST /api/jira-projects` ← `JiraProjectCreateDto` (validerer begge sum=100%)
- `PUT /api/jira-projects/{id}` ← `JiraProjectCreateDto` (validerer begge sum=100%)
- `DELETE /api/jira-projects/{id}`
- `GET /api/jira-projects/export` → JSON-fil med alle prosjekter + fordelingsnøkler
- `POST /api/jira-projects/import` ← `{ projects: JiraProjectCreateDto[] }` → `{ imported, updated, errors }`. Matcher på Key: oppdaterer eksisterende, oppretter nye.

### Månedslås
- `GET /api/monthly-locks?consultantId&year&month` → `{ isLocked, lockedAt }`
- `PUT /api/monthly-locks` ← `MonthlyLockToggleDto { consultantId, year, month, locked }` — toggler lås
- `GET /api/monthly-locks/by-month?year&month` → `MonthlyLock[]` (alle låser for måneden)

### Timeregistreringer
- `GET /api/time-entries?consultantId&year&month` → `TimeEntry[]`
- `PUT /api/time-entries` ← `TimeEntryUpsertDto` — upsert basert på (consultantId, jiraIssueKey, date). Validerer Jira-prosjektprefiks og månedslås.
- `DELETE /api/time-entries/{id}` — validerer månedslås
- `DELETE /api/time-entries/by-issue?consultantId&jiraIssueKey&year&month` — slett alle timer for en sak i en måned. Validerer månedslås.
- `GET /api/time-entries/export?consultantId&year&month` → JSON-fil
- `GET /api/time-entries/export/excel?consultantId&year&month` → Excel-fil (ClosedXML). Timeark med timer per dag per Jira-sak og fordeling per fakturaprosjekt. Filnavn: `Timeark_{Navn}_{Månedsnavn}_{år}.xlsx`
- `POST /api/time-entries/import` ← `TimeEntryImportDto` — sletter eksisterende for måneden, importerer nye. Validerer månedslås.

### Oversikt og rapporter
- `GET /api/monthly-summary?year&month` → sammendrag per konsulent for hjem-siden
- `GET /api/reports/monthly?year&month` → faktureringsdata per prosjekt (filtrert på ansatte i perioden, inkl. employerId)
- `GET /api/reports/monthly/excel?year&month&invoiceProjectId&employerId?` → Excel-fil (ClosedXML). Valgfri employerId filtrerer på arbeidsgiver. Filnavn: `{ShortName}_{Månedsnavn}_{år}.xlsx`
- `GET /api/reports/monthly/pdf?year&month&invoiceProjectId&employerId?` → PDF-fil (QuestPDF). Valgfri employerId filtrerer på arbeidsgiver og viser arbeidsgiver-navn i header. Filnavn: `{ShortName}_{Månedsnavn}_{år}.pdf`

## Frontend-komponenter

| Komponent | Fil | Beskrivelse | API-kall |
|-----------|-----|-------------|----------|
| Login | `login.js` | Innlogging med fornavn + e-post, lagrer bruker i localStorage | `POST /api/login` |
| Home | `home.js` | Oversikt ansatte i valgt måned, filtrert på innlogget brukers arbeidsgiver, fargekodert utfyllingsgrad, ferdig-status per konsulent. Mottar `year`/`month` som props fra app.js | `GET monthly-summary`, `GET monthly-locks/by-month` |
| TimeGrid | `time-grid.js` | Månedsrutenett for timeregistrering med autolagring, helgmarkering, sletteknapp per rad, valgfri visning (hh:mm/desimal). Støtter `locked`-prop for skrivebeskyttelse | `GET/PUT/DELETE time-entries` |
| GSheetImport | `gsheet-import.js` | Google Sheets-import modal (tab-separert copy-paste, kun admin). Emitter `imported` for reload | `POST time-entries/import` |
| ReportView | `report-view.js` | Faktureringsgrunnlag per fakturaprosjekt, filtrert på innlogget brukers arbeidsgiver, med seksjonsfordelte timer og Excel/PDF-eksport. Mottar `year`/`month` som props fra app.js | `GET reports/monthly`, `GET sections`, `GET jira-projects` |
| AdminEmployers | `admin-employers.js` | CRUD arbeidsgivere med org.nr., e-postdomene og adresse. Slett deaktivert for arbeidsgivere med konsulenter | `GET/POST/PUT/DELETE employers`, `GET employers/with-consultants` |
| AdminConsultants | `admin-consultants.js` | CRUD konsulenter med arbeidsgiver-dropdown, admin-flagg, aktiv-status og ansettelsesperiode. E-post valideres dynamisk mot valgt arbeidsgivers domene. Slett deaktivert for konsulenter med timer | `GET/POST/PUT/DELETE consultants`, `GET consultants/with-time-entries`, `GET employers` |
| AdminProjects | `admin-projects.js` | CRUD Jira-prosjekter med fordelingsnøkler og seksjonsfordeling, JSON eksport/import | `GET/POST/PUT/DELETE jira-projects`, `GET sections`, `GET invoice-projects` |
| MonthPicker | `month-picker.js` | Gjenbrukbar månedsvelger med forrige/neste-navigasjon. Plassert i navbaren av app.js, delt state for Hjem/Timeregistrering/Rapport | (ingen) |

App-komponent (`app.js`): tab-navigasjon, innloggingsstatus, Admin-fane kun synlig for IsAdmin-brukere med arkfaner (Jira-prosjekter, Konsulenter, Arbeidsgivere). MonthPicker er plassert sentrert i navbaren og deler måned-state mellom Hjem, Timeregistrering og Rapport (skjules på Admin-fanen). Håndterer månedslås-tilstand, "Marker som ferdig"-knapp og "Importer fra G-Sheet"-knapp (kun admin) i timeregistreringsfanen. Eksport-knapper (JSON og Excel) er alltid synlige, også når måneden er låst. Inkluderer dark/light theme toggle (localStorage-persistert).

## Forretningsregler

1. **Fordelingsnøkler er kjernelogikken:** Timer på en Jira-sak fordeles prosentvis på fakturaprosjekter basert på Jira-prosjektets nøkkel. Begge fordelinger (fakturaprosjekt + seksjon) må summere til 100%.
2. **Jira-saksnøkkel:** Format `PREFIKS-nummer`. Prefikset må finnes i JiraProjects.
3. **Unik registrering:** Én timeregistrering per konsulent per Jira-sak per dag.
4. **Ansettelsesfiltrering:** Hjem og Rapport filtrerer på konsulenter ansatt i valgt måned (EmployedFrom <= siste dag i mnd OG (EmployedTo IS NULL ELLER EmployedTo >= første dag i mnd)). Hjem filtrerer i tillegg bort konsulenter med CanRegisterHours=false.
5. **Admin-tilgang:** Kun IsAdmin=true ser Admin-fanen.
6. **E-postvalidering:** E-postdomenet må matche en registrert arbeidsgiver (dynamisk via Employers-tabellen). Valideres ved innlogging og konsulentopprettelse/-redigering.
7. **Arbeidsgiverfiltrering:** Hjem- og Rapport-siden viser kun konsulenter med samme arbeidsgiver som innlogget bruker. Excel/PDF-eksport filtrerer tilsvarende.
8. **Månedslås:** Konsulenter kan markere en måned som "ferdig". Låste måneder er skrivebeskyttet — API avviser alle skriveoperasjoner (upsert, delete, import) med 400. Låsen kan angres av konsulenten selv.
9. **Deaktivering:** Konsulenter kan deaktiveres (IsActive=false). Deaktiverte brukere kan ikke logge inn. Konsulenter med timeregistreringer kan ikke slettes — de må deaktiveres i stedet.
10. **Seksjonsfordeling i rapport:** Rapporten viser kolonner per seksjon med timer beregnet som `fakturaprosjekt-timer × seksjonsprosent / 100`. Samme kolonner i Excel- og PDF-eksport.

## Mønstre og konvensjoner

### Ny databasetabell
1. Opprett migreringsscript `Scripts/NNN_beskrivelse.sql` (neste ledige nummer)
2. Opprett modell i `Models/`
3. Opprett repository i `Repositories/`
4. Registrer repository i `Program.cs` med `builder.Services.AddScoped<>()`
5. Migrering kjøres automatisk ved oppstart via `DatabaseInitializer`

### Ny fordelingsnøkkel-type
Følg mønsteret fra DistributionKeys / SectionDistributionKeys:
- Egen tabell med FK til JiraProjects (CASCADE) og oppslagstabell (RESTRICT), UNIQUE constraint
- DTO i `Models/Dtos.cs`, leses/skrives i `JiraProjectRepository` innenfor samme transaksjon
- Sum-validering (=100%) i POST/PUT-endepunktene i `Program.cs`
- Frontend: prosentinputs i `admin-projects.js` modal, badges i tabell

### Repository-mønster
- Constructor tar `DbConnectionFactory`, bruker `using var connection = _connectionFactory.CreateConnection()`
- Skrive-operasjoner med flere tabeller bruker transaksjon (`connection.BeginTransaction()`)
- Returnerer DTO-er (ikke entiteter) fra lese-metoder som trenger joins
- Bruk `DateRange.ForMonth(year, month)` for å beregne start/slutt-dato for en måned

### Helpers (`Helpers/`)
- `JiraIssueKeyParser.ExtractProjectKey(issueKey)` — ekstraher prosjektnøkkel fra Jira-saksnøkkel (f.eks. "AFP" fra "AFP-123")
- `DateRange.ForMonth(year, month)` — returnerer `(firstDay, lastDay)` som yyyy-MM-dd strenger
- `MonthNames.Norwegian` — array med norske månedsnavn (indeks 0 er tom, 1-12 er månedsnavn)

### Services (`Services/`)
- `ReportService` — genererer Excel (ClosedXML) og PDF (QuestPDF) rapporter. Registrert som scoped service.

### Frontend-komponent
- ES6-modul som eksporterer Vue Options API-objekt med `template` som inline string
- Importerer `api` fra `../services/api.js`
- Data hentes i `mounted()` via `this.load()`

### Frontend-hjelpefunksjoner (`wwwroot/js/utils/formatting.js`)
- `MONTH_NAMES` — array med norske månedsnavn (0-indeksert)
- `MONTH_NAMES_SHORT` — korte månedsnavn (jan, feb, ...)
- `formatHours(hours, mode)` — formatering av timer (1 desimal eller hh:mm)
- `formatDistribution(hours, mode)` — formatering av fordelte timer (2 desimaler eller hh:mm)

## Viktig kontekst

- Les `./claude/PRD.md` for opprinnelig kravspesifikasjon og komplett Jira-prosjektliste med fordelingsmønstre
- Fakturering skjer månedlig — alt dreier seg om månedsperioder
- Systemet brukes av ~5 konsulenter
