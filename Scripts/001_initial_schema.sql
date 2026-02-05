-- Consultants table
CREATE TABLE Consultants (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    FirstName TEXT NOT NULL,
    LastName TEXT NOT NULL,
    Email TEXT NOT NULL UNIQUE
);

CREATE INDEX IX_Consultants_Email ON Consultants(Email);

-- Invoice Projects table
CREATE TABLE InvoiceProjects (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectNumber TEXT NOT NULL UNIQUE,
    Name TEXT NOT NULL
);

-- Jira Projects table
CREATE TABLE JiraProjects (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Key TEXT NOT NULL UNIQUE,
    Name TEXT NOT NULL
);

CREATE INDEX IX_JiraProjects_Key ON JiraProjects(Key);

-- Distribution Keys table (linking Jira projects to Invoice projects with percentages)
CREATE TABLE DistributionKeys (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    JiraProjectId INTEGER NOT NULL,
    InvoiceProjectId INTEGER NOT NULL,
    Percentage REAL NOT NULL,
    FOREIGN KEY (JiraProjectId) REFERENCES JiraProjects(Id) ON DELETE CASCADE,
    FOREIGN KEY (InvoiceProjectId) REFERENCES InvoiceProjects(Id) ON DELETE RESTRICT,
    UNIQUE(JiraProjectId, InvoiceProjectId)
);

CREATE INDEX IX_DistributionKeys_JiraProjectId ON DistributionKeys(JiraProjectId);

-- Time Entries table
CREATE TABLE TimeEntries (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ConsultantId INTEGER NOT NULL,
    JiraIssueKey TEXT NOT NULL,
    JiraProjectId INTEGER NOT NULL,
    Date TEXT NOT NULL,
    Hours REAL NOT NULL,
    FOREIGN KEY (ConsultantId) REFERENCES Consultants(Id) ON DELETE CASCADE,
    FOREIGN KEY (JiraProjectId) REFERENCES JiraProjects(Id) ON DELETE RESTRICT,
    UNIQUE(ConsultantId, JiraIssueKey, Date)
);

CREATE INDEX IX_TimeEntries_ConsultantId ON TimeEntries(ConsultantId);
CREATE INDEX IX_TimeEntries_Date ON TimeEntries(Date);
CREATE INDEX IX_TimeEntries_ConsultantId_Date ON TimeEntries(ConsultantId, Date)
