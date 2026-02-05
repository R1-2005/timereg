# PRD — Timeregistreringssystem

## 1. Sammendrag

Webbasert timeregistreringssystem for et lite konsulentteam (~5 personer). Timer registreres per Jira-sak og fordeles automatisk på fakturaprosjekter via konfigurerbare fordelingsnøkler. Systemet produserer månedlige faktureringsgrunnlag som Excel-eksport per fakturaprosjekt.

## 2. Teknologistakk

| Komponent | Teknologi |
|-----------|-----------|
| Backend | .NET 10, C# |
| Frontend | Vue 3 via CDN (ingen byggsteg) |
| Database | SQLite via Dapper |
| Utvikling | Crostini Linux (Chromebook) / Windows |
| Produksjon | IIS på Windows Server |

### 2.1 Frontend-arkitektur

Vue 3 lastes via CDN. Ingen npm, ingen Vite, ingen .vue-filer. Komponenter defineres som JavaScript-objekter i separate `.js`-filer under `wwwroot/js/components/`. Enkel SPA med hash-basert routing eller tab-navigasjon.

## 3. Datamodell

### 3.1 Konsulent (`Consultant`)
| Felt | Type | Beskrivelse |
|------|------|-------------|
| Id | int (PK) | Auto-generert |
| FirstName | string | Fornavn |
| LastName | string | Etternavn |
| Email | string (unique) | E-postadresse |

### 3.2 Fakturaprosjekt (`InvoiceProject`)
| Felt | Type | Beskrivelse |
|------|------|-------------|
| Id | int (PK) | Auto-generert |
| ProjectNumber | string (unique) | F.eks. "10108" |
| Name | string | F.eks. "AFP Systemutvikling" |

Seed-data:

| ProjectNumber | Name |
|---------------|------|
| 10108 | AFP Systemutvikling |
| 10607 | Sliterordningen LO/YS |
| 10608 | Sliterordningen Felles |
| 11003 | OU Samordningen |

### 3.3 Jira-prosjekt (`JiraProject`)
| Felt | Type | Beskrivelse |
|------|------|-------------|
| Id | int (PK) | Auto-generert |
| Key | string (unique) | Jira-prefiks, f.eks. "AFP" |
| Name | string | Beskrivende navn |

### 3.4 Fordelingsnøkkel (`DistributionKey`)
| Felt | Type | Beskrivelse |
|------|------|-------------|
| Id | int (PK) | Auto-generert |
| JiraProjectId | int (FK) | Referanse til JiraProject |
| InvoiceProjectId | int (FK) | Referanse til InvoiceProject |
| Percentage | decimal | Prosent (0-100). Sum per JiraProject skal alltid være 100 |

### 3.5 Timeregistrering (`TimeEntry`)
| Felt | Type | Beskrivelse |
|------|------|-------------|
| Id | int (PK) | Auto-generert |
| ConsultantId | int (FK) | Referanse til Consultant |
| JiraIssueKey | string | Full Jira-saksnøkkel, f.eks. "AFP-123" |
| JiraProjectId | int (FK) | Utledet fra JiraIssueKey (prefiks) |
| Date | DateOnly | Dato for registreringen |
| Hours | decimal | Timer som desimaltall |

**Unik constraint:** (ConsultantId, JiraIssueKey, Date) — én registrering per konsulent per sak per dag.

## 4. Jira-prosjekter og fordelingsnøkler — seed-data

### 4.1 Fordelingsmønstre

Det finnes seks fordelingsmønstre:

| Mønster | 10108 (AFP) | 10607 (SO LO/YS) | 10608 (SO Felles) | 11003 (OUS) |
|---------|-------------|-------------------|--------------------|----|
| Løpende AFP | 100% | — | — | — |
| 70/15/15 AFP/SO/OUS | 70% | 15% | — | 15% |
| 75/25 AFP/SO Felles | 75% | — | 25% | — |
| Løpende SO, kun LO/YS | — | 100% | — | — |
| Løpende SO felles | — | — | 100% | — |
| Løpende OUS | — | — | — | 100% |

### 4.2 Komplett prosjektliste

| Jira-nøkkel | Navn | Fordelingsmønster |
|---|---|---|
| AFPSAK | AFP saksbehandling, løpende endringer | Løpende AFP |
| ANONY | Anonymisering | 70/15/15 AFP/SO/OUS |
| AT24 | Oppdatert AFP søknadsskjema, fjerne AG-skjema | Løpende AFP |
| BEPO | Bedriftsportalen løpende endringer | 70/15/15 AFP/SO/OUS |
| CD | Dokumentgodkjenning Confluence og Jira | 70/15/15 AFP/SO/OUS |
| DIVN | Diverse Endringer | 70/15/15 AFP/SO/OUS |
| DOK | Dokumentasjon | 70/15/15 AFP/SO/OUS |
| DRIFT | Driftssaker | 70/15/15 AFP/SO/OUS |
| EFS | Etablering sikker utvikling | 70/15/15 AFP/SO/OUS |
| GDPRN | GDPR løpende endringer | 70/15/15 AFP/SO/OUS |
| JCDF | Sky Confluence og Jira drift og feilmeldingsaker løpende | 70/15/15 AFP/SO/OUS |
| JOCM | Jira og Confluence migrering | 70/15/15 AFP/SO/OUS |
| KF | Kvartalsfakturering felles | 70/15/15 AFP/SO/OUS |
| MFF | Månedsfaktuering felles | 70/15/15 AFP/SO/OUS |
| MP | Meldingsportalen | 70/15/15 AFP/SO/OUS |
| NA | Nytt NAV API - midlertidig løsning | 70/15/15 AFP/SO/OUS |
| NJLE | Journal/editor/PDF, løpende endringer | 70/15/15 AFP/SO/OUS |
| NOK | Økonomi / Visma, løpende endringer | 70/15/15 AFP/SO/OUS |
| NTILSLUT21 | Tilslutning endret hovednøkkel | 70/15/15 AFP/SO/OUS |
| NYAFPFAKT | AFP fakturering, løpende endringer | Løpende AFP |
| NYMINSIDE | MINSIDE | 75/25 AFP/SO Felles |
| NYSKD | SKD-overføringer, løpende endringer | 75/25 AFP/SO Felles |
| NYSOFAKT | SO Fakturering | Løpende SO, kun LO/YS |
| NYSOSAK | SO Saksbehandling | Løpende SO felles |
| NYSOUTBET | SO Utbetaling løpende endringer | Løpende SO felles |
| NYTILSLUT | Tilslutning løpende endringer | 70/15/15 AFP/SO/OUS |
| NYAAREG | AAREG Løpende endringer | 70/15/15 AFP/SO/OUS |
| OAFPT | Offentlig AFP teknisk utvikling | Løpende AFP |
| OU2021N | OU nyutvikling, fakturering og vasking | Løpende OUS |
| OUFAKTNY | OU fakturering, løpende endringer | Løpende OUS |
| OUVASK | OU vask, løpende endringer | Løpende OUS |
| SLETST | Sletteprosjekt testing | 70/15/15 AFP/SO/OUS |
| SLPRNY | Sletting Proventus | 70/15/15 AFP/SO/OUS |
| ST | Snudd Tilslutning | 70/15/15 AFP/SO/OUS |
| AAREGSKDNY | AAREGSKD Omlegging av import av aareg og SKD | 70/15/15 AFP/SO/OUS |
| P20 | Personvernprosjekt 2.0 | 70/15/15 AFP/SO/OUS |
| IO2T2 | Infrastrukturoppgradering | 70/15/15 AFP/SO/OUS |
| IOP | Infrastruktur og planlegging | 75/25 AFP/SO Felles |
| DOFA | Drift Offentlig AFP | Løpende AFP |

## 5. Brukergrensesnitt

### 5.1 Navigasjon

Enkel tab-basert navigasjon:
- **Timeregistrering** (hovedvisning)
- **Rapport** (faktureringsgrunnlag)
- **Admin** (konsulenter, Jira-prosjekter, fordelingsnøkler)

### 5.2 Innlogging

Enkel innlogging uten passord:
- Konsulenten oppgir fornavn og e-postadresse
- Valideres mot konsulentregisteret
- Ingen sesjonshåndtering utover å huske valgt konsulent i nettleseren (localStorage)

### 5.3 Timeregistrering — hovedvisning

#### Månedsvelger
- Velg måned og år øverst i visningen
- Navigasjonsknapper for forrige/neste måned
- Standard: inneværende måned

#### Timeregistreringstabell

Tabellstruktur (kolonne × rad):

| | 1 | 2 | 3 | ... | 31 | Sum |
|---|---|---|---|---|---|---|
| **AFP-123** | 1:30 | | 7,5 | ... | | 9,0 |
| **DRIFT-45** | | 3.5 | | ... | 2:00 | 5,5 |
| *(ny rad)* | | | | | | |
| **Sum timer** | **1,5** | **3,5** | **7,5** | | **2,0** | **14,5** |
| **10108 AFP** | 1,5 | 2,45 | 5,25 | | 1,4 | 10,6 |
| **10607 SO LO/YS** | 0 | 0,525 | 1,125 | | 0,3 | 1,95 |
| **10608 SO Felles** | 0 | 0 | 0 | | 0 | 0 |
| **11003 OUS** | 0 | 0,525 | 1,125 | | 0,3 | 1,95 |

Funksjonalitet:
- **Rader:** Hver rad er en Jira-sak (f.eks. "AFP-123"). Første kolonne er saksnøkkelen.
- **Kolonner:** Én kolonne per dag i valgt måned (1-28/29/30/31), pluss sum-kolonne.
- **Ny rad:** Siste rad er alltid tom for å legge til ny Jira-sak. Brukeren skriver saksnøkkelen og den valideres mot Jira-prosjektregisteret (prefikset må finnes).
- **Input-format:** Timer kan skrives som `h:mm` (f.eks. `1:30`), eller desimaltall med komma (`1,5`) eller punktum (`1.5`). Vises konsekvent som desimaltall med én desimal etter lagring.
- **Summering nederst:**
  - **Sum timer:** Total per dag (alle saker)
  - **Per fakturaprosjekt:** Beregnet sum per dag per fakturaprosjekt, basert på fordelingsnøklene
- **Sum-kolonne til høyre:** Total per rad (per Jira-sak) for hele måneden
- **Autolagring:** Timer lagres automatisk ved endring (blur/tab ut av celle), ingen "Lagre"-knapp

### 5.4 Rapport — faktureringsgrunnlag

Visning av faktureringsgrunnlag per måned:
- Velg måned
- Viser én tabell per fakturaprosjekt (10108, 10607, 10608, 11003)
- Hver tabell viser:
  - Konsulent
  - Jira-saker som bidrar til dette prosjektet
  - Timer per sak (etter fordeling)
  - Totalt per konsulent
  - Totalt for prosjektet
- **Excel-eksport:** Knapp for å laste ned Excel-fil per fakturaprosjekt

### 5.5 Admin

#### Konsulentadministrasjon
- Liste over registrerte konsulenter
- Legg til ny: fornavn, etternavn, e-postadresse
- Rediger eksisterende
- Slett (med advarsel om at timer også slettes, eller soft delete)

#### Jira-prosjekter og fordelingsnøkler
- Liste over Jira-prosjekter med tilhørende fordelingsnøkler
- Legg til nytt Jira-prosjekt: nøkkel, navn, fordeling i prosent per fakturaprosjekt
- Rediger eksisterende
- Validering: fordelingsprosenter per Jira-prosjekt må summere til 100%

## 6. API-design

### 6.1 Konsulenter
- `GET /api/consultants` — alle konsulenter
- `POST /api/consultants` — ny konsulent
- `PUT /api/consultants/{id}` — oppdater
- `DELETE /api/consultants/{id}` — slett

### 6.2 Jira-prosjekter
- `GET /api/jira-projects` — alle med fordelingsnøkler
- `POST /api/jira-projects` — nytt prosjekt med nøkler
- `PUT /api/jira-projects/{id}` — oppdater inkl. nøkler
- `DELETE /api/jira-projects/{id}` — slett

### 6.3 Fakturaprosjekter
- `GET /api/invoice-projects` — alle fakturaprosjekter

### 6.4 Timeregistrering
- `GET /api/time-entries?consultantId={id}&year={y}&month={m}` — alle timer for konsulent i måned
- `PUT /api/time-entries` — opprett eller oppdater en timeregistrering (upsert basert på consultantId + jiraIssueKey + date)
- `DELETE /api/time-entries/{id}` — slett en registrering

### 6.5 Rapporter
- `GET /api/reports/monthly?year={y}&month={m}` — faktureringsgrunnlag for måned, gruppert per fakturaprosjekt
- `GET /api/reports/monthly/excel?year={y}&month={m}&invoiceProjectId={id}` — Excel-eksport for ett fakturaprosjekt

### 6.6 Innlogging
- `POST /api/login` — { firstName, email } → returnerer konsulent-objekt eller 401

## 7. Validering og forretningsregler

1. **Jira-saksnøkkel:** Format `PREFIKS-nummer`. Prefikset må finnes i Jira-prosjektregisteret. Eksempel: "AFP-123" er gyldig kun hvis "AFP" er registrert.
2. **Timer-input:** Aksepterer `h:mm`, desimal med komma, desimal med punktum. Lagres som decimal. Maks 24 timer per dag per sak.
3. **Fordelingsnøkler:** Prosenter per Jira-prosjekt må summere til nøyaktig 100%.
4. **Unik registrering:** Én timeregistrering per konsulent per Jira-sak per dag.
5. **Datoformat i frontend:** `dd.MM` i tabellhoder, `dd.MM.yyyy` der fullt årstall er relevant.

## 8. Implementeringsfaser

### Fase 1 — Grunnmur
1. .NET-prosjekt med SQLite og Dapper
2. SQL-skript for skjema og seed-data
3. Repository-lag med Dapper-spørringer
4. API-endepunkter for alle entiteter

### Fase 2 — Admin
1. Konsulentadministrasjon (CRUD)
2. Jira-prosjekt og fordelingsnøkkel-administrasjon
3. Enkel innlogging

### Fase 3 — Timeregistrering
1. Månedsvelger-komponent
2. Timeregistreringstabell med input-parsing
3. Validering av Jira-saksnøkler
4. Autolagring
5. Summering per dag, per sak, per fakturaprosjekt

### Fase 4 — Rapportering
1. Månedlig faktureringsgrunnlag per prosjekt
2. Excel-eksport