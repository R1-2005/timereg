# CLAUDE.md — Timeregistreringssystem

## Prosjektoversikt

Internt timeregistreringssystem for konsulenter. Timer registreres per Jira-sak og fordeles automatisk på fakturaprosjekter via konfigurerbare fordelingsnøkler. Systemet genererer månedlige faktureringsgrunnlag.

## Teknologistakk

- **Backend:** .NET 10 (C#), minimal API
- **Frontend:** Vue 3 via CDN (ingen byggsteg, ingen npm/node)
- **Database:** SQLite via Dapper
- **Excel-eksport:** ClosedXML
- **PDF-eksport:** QuestPDF
- **Produksjon:** Kjører i IIS på Windows Server
- **Utvikling:** Crostini Linux (Chromebook) og Windows

## Viktige arkitekturbeslutninger

### Frontend uten byggsteg
Vue 3 lastes via CDN (`<script src="https://unpkg.com/vue@3">`). Ingen .vue-filer, ingen Vite, ingen npm. Alt frontend-kode lever som `.js`-filer i `wwwroot/` med Vue komponent-objekter. HTML-templates skrives inline i JavaScript eller i `<template>`-tagger i HTML.

### Enkelt .NET-prosjekt
Hele løsningen er ett .NET-prosjekt som serverer både API og statiske filer. Ingen separate frontend/backend-prosjekter.

### SQLite som eneste datalager
Ingen ekstern database. SQLite-filen lever i prosjektmappen. Skjemaendringer håndteres via SQL-skript i `Scripts/`-mappen.

## Utviklingsregler

### Kodekonvensjoner
- C#-kode følger standard .NET-konvensjoner
- JavaScript bruker moderne ES6+ syntaks
- Alle API-endepunkter returnerer JSON
- Alle datoer i API-lag brukes som ISO 8601, konverteres i frontend til `dd.MM`/`dd.MM.yyyy`
- Timer aksepteres som `h:mm` (f.eks. `1:30`), eller desimaltall med komma (`1,5`) eller punktum (`1.5`). Lagres alltid som desimaltall internt.

### Mappestruktur
```
/
├── CLAUDE.md
├── claude/
│   └── PRD.md
├── Program.cs
├── appsettings.json
├── Models/
│   ├── Consultant.cs
│   ├── DistributionKey.cs
│   ├── Dtos.cs
│   ├── InvoiceProject.cs
│   ├── JiraProject.cs
│   └── TimeEntry.cs
├── Data/
│   ├── DatabaseInitializer.cs
│   └── DbConnectionFactory.cs
├── Repositories/
│   ├── ConsultantRepository.cs
│   ├── InvoiceProjectRepository.cs
│   ├── JiraProjectRepository.cs
│   ├── ReportRepository.cs
│   └── TimeEntryRepository.cs
├── Scripts/
│   ├── 001_initial_schema.sql
│   └── 002_seed_data.sql
├── wwwroot/
│   ├── index.html
│   ├── css/
│   │   └── app.css
│   └── js/
│       ├── app.js
│       ├── components/
│       │   ├── admin-consultants.js
│       │   ├── admin-projects.js
│       │   ├── home.js
│       │   ├── login.js
│       │   ├── month-picker.js
│       │   ├── report-view.js
│       │   └── time-grid.js
│       └── services/
│           └── api.js
└── timeregistrering.db
```

### Kjøring
```bash
# Utvikling (Crostini/Windows)
dotnet run

# Produksjon (Windows/IIS)
dotnet publish -c Release
```

## Testdata og seed

Ved første kjøring skal databasen seedes med:
- De fire fakturaprosjektene (10108, 10607, 10608, 11003)
- Alle Jira-prosjekter med fordelingsnøkler fra PRD
- Ingen konsulenter (legges inn manuelt via admin)

## Implementerte funksjoner

Alle fire faser fra PRD er fullført.

### Navigasjon (etter innlogging)
- **Hjem** — Oversikt over alle konsulenter med fakturert tid og utfyllingsgrad (fargekodert: rød/orange/grønn)
- **Timeregistrering** — Registrer timer per Jira-sak i månedsrutenett med ukedager, helgmarkering (rød tekst), sletteknapp per rad, og JSON eksport/import
- **Rapport** — Faktureringsgrunnlag per fakturaprosjekt med Excel- og PDF-eksport
- **Admin** — Administrer konsulenter og Jira-prosjekter med fordelingsnøkler

### API-endepunkter
- `POST /api/login` — Innlogging med fornavn og e-post
- `GET/POST/PUT/DELETE /api/consultants` — Konsulent-CRUD
- `GET /api/invoice-projects` — Liste fakturaprosjekter
- `GET/POST/PUT/DELETE /api/jira-projects` — Jira-prosjekter med fordelingsnøkler
- `GET/PUT/DELETE /api/time-entries` — Timeregistreringer
- `DELETE /api/time-entries/by-issue` — Slett alle timer for en Jira-sak
- `GET /api/time-entries/export` — Eksporter timer som JSON-fil
- `POST /api/time-entries/import` — Importer timer fra JSON (overskriver eksisterende)
- `GET /api/monthly-summary` — Sammendrag for hjem-siden
- `GET /api/reports/monthly` — Faktureringsdata per prosjekt
- `GET /api/reports/monthly/excel` — Excel-eksport per fakturaprosjekt
- `GET /api/reports/monthly/pdf` — PDF-eksport per fakturaprosjekt

## Viktig kontekst

- Les `./claude/PRD.md` for full kravspesifikasjon
- Systemet brukes av ~5 konsulenter
- Fakturering skjer månedlig — alt dreier seg om månedsperioder
- Fordelingsnøklene er kjernelogikken: timer på en Jira-sak fordeles prosentvis på fakturaprosjekter basert på Jira-prosjektets nøkkel
- Ingen autentisering utover å velge sin konsulent ved innlogging (fornavn + e-post)
- Ingen rettighets- eller rollestyring