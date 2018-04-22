-- Adventure database install script

-- These tables contain site contents.
-- Any sets in a column must match what's in your "config.json."

CREATE TABLE `Contributions` (
	`ContributionUUID` BINARY(16) NOT NULL,
	`UserUUID` BINARY(16) NOT NULL,
	`ProductTitle` VARCHAR(100) NOT NULL COLLATE 'utf8_bin',
	`ReleaseTitle` VARCHAR(50) NOT NULL COLLATE 'utf8_bin',
	`VendorName` VARCHAR(50) NULL DEFAULT NULL COLLATE 'utf8_bin',
	`ReleaseDate` TIMESTAMP NULL DEFAULT NULL,
	`EOLDate` TIMESTAMP NULL DEFAULT NULL,
	`Platform` SET('DOS','CPM','Windows','OS2','Unix','Linux','MacOS','Mac OS X','DOSShell','Other') NULL DEFAULT NULL COLLATE 'utf8_bin',
	`Arch` SET('x86','x86-32','m68k','ppc','amd64','mos6502','ppc64','SPARC','SPARC64','MIPS','MIPS64','Alpha','Other') NULL DEFAULT NULL COLLATE 'utf8_bin',
	`CPURequirement` VARCHAR(150) NULL DEFAULT NULL COLLATE 'utf8_bin',
	`RAMRequirement` INT(10) UNSIGNED NULL DEFAULT NULL,
	`DiskRequirement` INT(10) UNSIGNED NULL DEFAULT NULL,
	`AboutRelease` TEXT NULL DEFAULT NULL COLLATE 'utf8_bin',
	`InstallInstructions` TEXT NULL DEFAULT NULL COLLATE 'utf8_bin',
	`FTPUser` VARCHAR(50) NULL DEFAULT NULL COLLATE 'utf8_bin',
	`FTPPassword` VARCHAR(350) NULL DEFAULT NULL COLLATE 'utf8_bin',
	`FTPUploadDirectory` VARCHAR(350) NULL DEFAULT NULL COLLATE 'utf8_bin',
	`Status` ENUM('New','Uploaded','Processing','Public','Verified','Rejected') NOT NULL DEFAULT 'New' COLLATE 'utf8_bin',
	`FTPAccountEnabled` SET('True','False') NOT NULL DEFAULT 'True' COLLATE 'utf8_bin',
	`ContributionCreated` TIMESTAMP NOT NULL DEFAULT '',
	`ProcessTime` TIMESTAMP NULL DEFAULT NULL,
	`ProcessBy` BINARY(16) NULL DEFAULT NULL,
	`LinkedProduct` BINARY(16) NULL DEFAULT NULL,
	`LinkedRelease` BINARY(16) NULL DEFAULT NULL,
	`RejectionReason` TEXT NULL DEFAULT NULL COLLATE 'utf8_bin',
	PRIMARY KEY (`ContributionUUID`),
	INDEX `UserUUID` (`UserUUID`)
)
COLLATE='utf8_bin'
ENGINE=Aria
;

CREATE TABLE `DownloadHits` (
	`DownloadUUID` BINARY(16) NOT NULL,
	`MirrorUUID` BINARY(16) NOT NULL,
	`SessionUUID` BINARY(16) NULL DEFAULT NULL,
	`UserUUID` BINARY(16) NULL DEFAULT NULL,
	`IPAddress` VARCHAR(46) NOT NULL COLLATE 'utf8_bin',
	`DownloadTime` TIMESTAMP NOT NULL DEFAULT '',
	INDEX `DownloadUUID` (`DownloadUUID`),
	INDEX `UserUUID` (`UserUUID`),
	INDEX `MirrorUUID` (`MirrorUUID`),
	INDEX `DownloadTime` (`DownloadTime`),
	INDEX `IPAddress` (`IPAddress`)
)
COLLATE='utf8_bin'
ENGINE=Aria
;

CREATE TABLE `DownloadMirrors` (
	`MirrorUUID` BINARY(16) NOT NULL,
	`MirrorName` VARCHAR(50) NOT NULL COLLATE 'utf8_bin',
	`Hostname` VARCHAR(50) NULL DEFAULT NULL COLLATE 'utf8_bin',
	`IsOnline` ENUM('True','False') NULL DEFAULT 'True' COLLATE 'utf8_bin',
	`Location` VARCHAR(50) NULL DEFAULT NULL COLLATE 'utf8_bin',
	`UnixUser` VARCHAR(20) NULL DEFAULT NULL COLLATE 'utf8_bin',
	`HomeDirectory` VARCHAR(150) NULL DEFAULT NULL COLLATE 'utf8_bin',
	`DownloadDirectory` VARCHAR(150) NULL DEFAULT NULL COLLATE 'utf8_bin',
	`Country` ENUM('FR','UK','US','JP','EU','CA') NULL DEFAULT NULL COLLATE 'utf8_bin',
	`Webserver` ENUM('True','False') NOT NULL DEFAULT 'False' COLLATE 'utf8_bin',
	`SSHFingerprint` VARBINARY(100) NULL DEFAULT NULL,
	PRIMARY KEY (`MirrorUUID`)
)
COLLATE='utf8_bin'
ENGINE=Aria
;

CREATE TABLE `Downloads` (
	`DLUUID` BINARY(16) NOT NULL,
	`Name` VARCHAR(150) NOT NULL COLLATE 'utf8_bin',
	`Version` VARCHAR(40) NOT NULL COLLATE 'utf8_bin',
	`RTM` ENUM('True','False') NOT NULL DEFAULT 'True' COLLATE 'utf8_bin',
	`SHA1Sum` BINARY(20) NOT NULL,
	`OriginalPath` TEXT NOT NULL COLLATE 'utf8_bin',
	`DownloadPath` TEXT NOT NULL COLLATE 'utf8_bin',
	`ImageType` ENUM('Archive','35Floppy','525Floppy','CDISO','DVDISO','VPC','VMWARE','VBOX') NOT NULL DEFAULT 'Archive' COLLATE 'utf8_bin',
	`Arch` SET('x86','x86-32','m68k','ppc','amd64','mos6502','ppc64','SPARC','SPARC64','MIPS','MIPS64','Alpha','Other') NOT NULL DEFAULT 'x86' COLLATE 'utf8_bin',
	`Information` TEXT NULL DEFAULT NULL COLLATE 'utf8_bin',
	`ReleaseUUID` BINARY(16) NULL DEFAULT NULL,
	`Upgrade` ENUM('True','False') NOT NULL DEFAULT 'False' COLLATE 'utf8_bin',
	`VIPOnly` ENUM('True','False') NOT NULL DEFAULT 'False' COLLATE 'utf8_bin',
	`Language` VARCHAR(50) NOT NULL DEFAULT 'English' COLLATE 'utf8_bin',
	`FileSize` BIGINT(20) NULL DEFAULT NULL,
	`FileName` VARCHAR(250) NULL DEFAULT NULL COLLATE 'utf8_bin',
	`ContributionUUID` BINARY(16) NULL DEFAULT NULL,
	`CreatedDate` TIMESTAMP NULL DEFAULT '',
	`LastUpdated` TIMESTAMP NULL DEFAULT '',
	`NoShowOnHome` ENUM('True','False') NOT NULL DEFAULT 'False' COLLATE 'utf8_bin',
	PRIMARY KEY (`DLUUID`),
	INDEX `ReleaseUUID` (`ReleaseUUID`),
	INDEX `FileName` (`Name`),
	INDEX `ContributionUUID` (`ContributionUUID`),
	INDEX `NoShowOnHome` (`NoShowOnHome`),
	INDEX `CreatedDate` (`CreatedDate`),
	INDEX `LastUpdated` (`LastUpdated`),
	FULLTEXT INDEX `Information` (`Information`)
)
COLLATE='utf8_bin'
ENGINE=Aria
;

CREATE TABLE `MirrorContents` (
	`MirrorUUID` BINARY(16) NULL DEFAULT NULL,
	`DownloadUUID` BINARY(16) NULL DEFAULT NULL,
	INDEX `UUIDS` (`MirrorUUID`, `DownloadUUID`)
)
COLLATE='utf8_bin'
ENGINE=Aria
;

CREATE TABLE `Products` (
	`ProductUUID` BINARY(16) NOT NULL,
	`DiscussionUUID` BINARY(16) NOT NULL,
	`Name` VARCHAR(150) NOT NULL,
	`Slug` VARCHAR(100) NULL DEFAULT NULL,
	`Notes` TEXT NOT NULL,
	`LogoImage` VARCHAR(150) NULL DEFAULT NULL,
	`Type` ENUM('OS','Game','Application','DevTool','System') NOT NULL DEFAULT 'Application',
	`ProductCreated` TIMESTAMP NULL DEFAULT '',
	`DefaultRelease` BINARY(16) NULL DEFAULT NULL,
	`ApplicationTags` SET('Word Processor','Spreadsheet','Presentations','Web Browser','Chat','Utility','Graphics','Publishing','Financial','Reference','Editor','Communications','Novelty','PIM','Video','Audio','Document','Media Player','Virtualization','Archive','Other','Server','Database','Mathematics','Planning','Education','Engineering') NULL DEFAULT NULL,
	PRIMARY KEY (`ProductUUID`),
	INDEX `Name_Slug` (`Name`, `Slug`),
	INDEX `Type_Platform` (`Type`),
	INDEX `DefaultRelease` (`DefaultRelease`),
	INDEX `ApplicationTags` (`ApplicationTags`),
	INDEX `DiscussionUUID` (`DiscussionUUID`),
	FULLTEXT INDEX `Notes` (`Notes`),
	FULLTEXT INDEX `Name_Notes` (`Name`, `Notes`),
	FULLTEXT INDEX `Name` (`Name`)
)
COLLATE='utf8_general_ci'
ENGINE=Aria
;

CREATE TABLE `Releases` (
	`ReleaseUUID` BINARY(16) NOT NULL,
	`ProductUUID` BINARY(16) NOT NULL,
	`Name` VARCHAR(50) NOT NULL COLLATE 'utf8_general_ci',
	`VendorName` VARCHAR(50) NULL DEFAULT NULL COLLATE 'utf8_general_ci',
	`Slug` VARCHAR(100) NULL DEFAULT NULL COLLATE 'utf8_bin',
	`ReleaseOrder` INT(11) NOT NULL DEFAULT '0',
	`ReleaseDate` TIMESTAMP NULL DEFAULT NULL,
	`EndOfLife` TIMESTAMP NULL DEFAULT NULL,
	`FuzzyDate` ENUM('True','False') NOT NULL DEFAULT 'False' COLLATE 'utf8_bin',
	`Arch` SET('x86','x86-32','m68k','ppc','amd64','mos6502','ppc64','SPARC','SPARC64','MIPS','MIPS64','Alpha','Other') NULL DEFAULT NULL COLLATE 'utf8_bin',
	`RAMRequirement` INT(10) UNSIGNED NULL DEFAULT NULL COMMENT 'in bytes',
	`CPURequirement` VARCHAR(50) NULL DEFAULT NULL COLLATE 'utf8_bin',
	`DiskSpaceRequired` INT(10) UNSIGNED NULL DEFAULT NULL COMMENT 'in bytes',
	`MultiUser` ENUM('Yes','No') NOT NULL DEFAULT 'No' COLLATE 'utf8_bin',
	`Networking` VARCHAR(300) NULL DEFAULT NULL COLLATE 'utf8_bin',
	`Type` ENUM('GUI','Text') NOT NULL DEFAULT 'GUI' COLLATE 'utf8_bin',
	`SerialRequired` ENUM('True','False') NOT NULL DEFAULT 'False' COLLATE 'utf8_bin',
	`InstallInstructions` LONGTEXT NULL DEFAULT NULL COLLATE 'utf8_general_ci',
	`Notes` LONGTEXT NULL DEFAULT NULL COLLATE 'utf8_general_ci',
	`Platform` SET('DOS','CPM','Windows','OS2','Unix','Linux','MacOS','Mac OS X','DOSShell','Other') NULL DEFAULT NULL COLLATE 'utf8_bin',
	`DefaultDownload` BINARY(16) NULL DEFAULT NULL,
	PRIMARY KEY (`ReleaseUUID`),
	INDEX `ProductUUID` (`ProductUUID`),
	INDEX `Slug` (`Slug`),
	INDEX `ReleaseDate_EndOfLife` (`ReleaseDate`, `EndOfLife`) USING BTREE,
	INDEX `ReleaseOrder` (`ReleaseOrder`) USING BTREE,
	INDEX `Platform` (`Platform`),
	INDEX `Arch` (`Arch`),
	FULLTEXT INDEX `Name_VendorName_InstallInstructions_Notes` (`InstallInstructions`, `Notes`, `Name`, `VendorName`)
)
COLLATE='utf8_bin'
ENGINE=Aria
;

CREATE TABLE `Screenshots` (
	`ScreenshotUUID` BINARY(16) NOT NULL,
	`ReleaseUUID` BINARY(16) NULL DEFAULT NULL,
	`ScreenshotTitle` VARCHAR(750) NULL DEFAULT NULL COLLATE 'utf8_bin',
	`ScreenshotFile` VARCHAR(350) NULL DEFAULT NULL COLLATE 'utf8_bin',
	PRIMARY KEY (`ScreenshotUUID`),
	INDEX `ReleaseUUID` (`ReleaseUUID`)
)
COLLATE='utf8_bin'
ENGINE=Aria
;

CREATE TABLE `Serials` (
	`ReleaseUUID` BINARY(16) NULL DEFAULT NULL,
	`Serial` VARCHAR(500) NULL DEFAULT NULL COLLATE 'utf8_bin',
	INDEX `ReleaseUUID` (`ReleaseUUID`) USING HASH
)
COLLATE='utf8_bin'
ENGINE=Aria
;

CREATE TABLE `UserFlagHolders` (
	`FlagUUID` BINARY(16) NOT NULL,
	`UserUUID` BINARY(16) NOT NULL,
	`Added` TIMESTAMP NOT NULL DEFAULT '',
	INDEX `GroupUUID` (`FlagUUID`),
	INDEX `UserUUID` (`UserUUID`)
)
COLLATE='utf8_bin'
ENGINE=Aria
;

CREATE TABLE `UserFlags` (
	`FlagUUID` BINARY(16) NOT NULL,
	`FlagName` VARCHAR(15) NOT NULL,
	`LongName` VARCHAR(250) NOT NULL,
	`SystemFlag` ENUM('True','False') NOT NULL DEFAULT 'False',
	`Preemptive` ENUM('True','False') NOT NULL DEFAULT 'False',
	`PublicVisible` ENUM('True','False') NOT NULL DEFAULT 'False',
	`FlagColour` VARCHAR(10) NULL DEFAULT NULL,
	PRIMARY KEY (`FlagUUID`),
	UNIQUE INDEX `FlagName` (`FlagName`)
)
COLLATE='utf8_general_ci'
ENGINE=InnoDB
;

CREATE TABLE `Users` (
	`UserID` BINARY(16) NOT NULL,
	`Email` VARCHAR(80) NOT NULL COLLATE 'utf8_unicode_ci',
	`AccountEnabled` ENUM('True','False') NOT NULL DEFAULT 'True' COLLATE 'utf8_unicode_ci',
	`Password` VARCHAR(64) NOT NULL COLLATE 'utf8_unicode_ci',
	`Salt` VARCHAR(64) NULL DEFAULT NULL COLLATE 'utf8_unicode_ci',
	`ShortName` VARCHAR(64) NULL DEFAULT NULL COLLATE 'utf8_unicode_ci',
	`RegistrationTime` TIMESTAMP NOT NULL DEFAULT '',
	`LastSeenTime` TIMESTAMP NOT NULL DEFAULT '',
	`RegistrationIP` VARCHAR(45) NOT NULL COLLATE 'utf8_unicode_ci',
	`ThemeName` VARCHAR(50) NOT NULL DEFAULT 'default' COLLATE 'utf8_unicode_ci',
	PRIMARY KEY (`UserID`),
	UNIQUE INDEX `UniqueVals` (`ShortName`, `Email`)
)
COLLATE='utf8_unicode_ci'
ENGINE=Aria
ROW_FORMAT=
;

CREATE TABLE `UserRecoverPasswordRequests` (
	`RequestID` BINARY(16) NOT NULL,
	`UserID` BINARY(16) NOT NULL,
	`DateCreated` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (`RequestID`),
	UNIQUE INDEX `UserID` (`UserID`),
	UNIQUE INDEX `RequestID` (`RequestID`)
)
COLLATE='utf8_general_ci'
ENGINE=InnoDB
;

-- These triggers will create new UUIDs for each item type addressable by UUIDs.
-- The definer should match the SQL user you use for Adventure.

CREATE DEFINER=`root`@`localhost` TRIGGER `BeforeCreateContribution` BEFORE INSERT ON `Contributions` FOR EACH ROW BEGIN
    SET NEW.ContributionUUID = UUIDBIN(UUID());
END

CREATE DEFINER=`root`@`localhost` TRIGGER `BeforeCreateDownload` BEFORE INSERT ON `Downloads` FOR EACH ROW BEGIN
    SET New.DLUUID = UUIDBIN(UUID());
END

CREATE DEFINER=`root`@`localhost` TRIGGER `BeforeCreateFlags` BEFORE INSERT ON `UserFlags` FOR EACH ROW BEGIN
	SET NEW.FlagUUID = UUIDBIN(UUID());
END

CREATE DEFINER=`root`@`localhost` TRIGGER `BeforeCreateMirror` BEFORE INSERT ON `DownloadMirrors` FOR EACH ROW BEGIN
    SET NEW.MirrorUUID = UUIDBIN(UUID());
END

CREATE DEFINER=`root`@`localhost` TRIGGER `BeforeCreateProduct` BEFORE INSERT ON `Products` FOR EACH ROW BEGIN
	SET NEW.ProductUUID = UUIDBIN(UUID());
END

CREATE DEFINER=`root`@`localhost` TRIGGER `BeforeCreateRelease` BEFORE INSERT ON `Releases` FOR EACH ROW BEGIN
   SET NEW.ReleaseUUID = UUIDBIN(UUID());
END

CREATE DEFINER=`root`@`localhost` TRIGGER `BeforeCreateScreenshot` BEFORE INSERT ON `Screenshots` FOR EACH ROW BEGIN
	SET NEW.ScreenshotUUID = UUIDBIN(UUID());
END

CREATE DEFINER=`root`@`localhost` TRIGGER `BeforeCreateUser` BEFORE INSERT ON `Users` FOR EACH ROW BEGIN
	SET NEW.UserID = UUIDBIN(UUID());
	SET NEW.RegistrationTime = NOW();
END

CREATE DEFINER=`root`@`localhost` TRIGGER `BeforeCreateRecoverPassword` BEFORE INSERT ON `UserRecoverPasswordRequests` FOR EACH ROW BEGIN
	SET NEW.RequestID = UUIDBIN(UUID());
	SET NEW.DateCreated = NOW();
END

-- This is to create an administrative user and initial flags.
-- By default, the user's password is "changeme" - for obvious reasons, change this!

-- The "VIP" user is configured to have twice the downloads per day; while site admin is self-explanatory.

INSERT INTO `UserFlags` (`FlagUUID`, `FlagName`, `LongName`, `SystemFlag`, `Preemptive`, `PublicVisible`, `FlagColour`) VALUES (0x25C5A043C3867BC2B311C3A4C29D7100, 'sa', 'Site Admin', 'True', 'False', 'True', 'primary');
INSERT INTO `UserFlags` (`FlagUUID`, `FlagName`, `LongName`, `SystemFlag`, `Preemptive`, `PublicVisible`, `FlagColour`) VALUES (0x3EC2B140127BC2B311C3A4C29D710015, 'vip', 'VIP Member', 'False', 'False', 'True', 'success');

INSERT INTO `Users` (`UserID`, `Email`, `AccountEnabled`, `Password`, `Salt`, `ShortName`, `RegistrationTime`, `LastSeenTime`, `RegistrationIP`, `ThemeName`) VALUES (0x7B05DE4D3F2111E88D2AFA163E9022F0, 'root@localhost', 'True', '$2a$12$I7Z0lrQFyxgRFgWVB8FX1.FYpJDEN7Z5x4Mp4a7I8bT26G3OU8USa', '', 'admin', '2014-08-13 10:42:20', '2018-04-07 00:27:28', '', 'default');

INSERT INTO `UserFlagHolders` (`FlagUUID`, `UserUUID`, `Added`) VALUES (0x25C5A043C3867BC2B311C3A4C29D7100, 0x7B05DE4D3F2111E88D2AFA163E9022F0, '2017-08-02 04:26:41');

-- This function is for supporting the triggers above.

CREATE DEFINER=`root`@`localhost` FUNCTION `UUIDBIN`(
	`_uuid` TINYTEXT



)
RETURNS binary(16)
LANGUAGE SQL
DETERMINISTIC
NO SQL
SQL SECURITY DEFINER
COMMENT ''
BEGIN
	RETURN UNHEX(REPLACE(_uuid, '-', ''));
END
