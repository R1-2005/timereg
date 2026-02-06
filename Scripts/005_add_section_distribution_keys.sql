CREATE TABLE Sections (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL UNIQUE
);

INSERT INTO Sections (Name) VALUES ('Seksjon teknologi');
INSERT INTO Sections (Name) VALUES ('Infrastruktur og plattform');
INSERT INTO Sections (Name) VALUES ('Personvernprogrammet');

CREATE TABLE SectionDistributionKeys (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    JiraProjectId INTEGER NOT NULL,
    SectionId INTEGER NOT NULL,
    Percentage REAL NOT NULL,
    FOREIGN KEY (JiraProjectId) REFERENCES JiraProjects(Id) ON DELETE CASCADE,
    FOREIGN KEY (SectionId) REFERENCES Sections(Id) ON DELETE RESTRICT,
    UNIQUE(JiraProjectId, SectionId)
);

INSERT INTO SectionDistributionKeys (JiraProjectId, SectionId, Percentage)
SELECT Id, 1, 100 FROM JiraProjects;
