-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               10.1.40-MariaDB-0ubuntu0.18.04.1 - Ubuntu 18.04
-- Server OS:                    debian-linux-gnu
-- HeidiSQL Version:             9.5.0.5196
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;

-- Dumping structure for table winworld.Contributions
CREATE TABLE IF NOT EXISTS `Contributions` (
  `ContributionUUID` binary(16) NOT NULL,
  `UserUUID` binary(16) NOT NULL,
  `ProductTitle` varchar(100) COLLATE utf8_bin NOT NULL,
  `ReleaseTitle` varchar(50) COLLATE utf8_bin NOT NULL,
  `VendorName` varchar(50) COLLATE utf8_bin DEFAULT NULL,
  `ReleaseDate` timestamp NULL DEFAULT NULL,
  `EOLDate` timestamp NULL DEFAULT NULL,
  `Platform` set('DOS','CPM','Windows','OS2','Unix','Linux','MacOS','Mac OS X','DOSShell','Other') COLLATE utf8_bin DEFAULT NULL,
  `Arch` set('x86','x86-32','m68k','ppc','amd64','mos6502','ppc64','SPARC','SPARC64','MIPS','MIPS64','Alpha','Other') COLLATE utf8_bin DEFAULT NULL,
  `CPURequirement` varchar(150) COLLATE utf8_bin DEFAULT NULL,
  `RAMRequirement` int(10) unsigned DEFAULT NULL,
  `DiskRequirement` int(10) unsigned DEFAULT NULL,
  `AboutRelease` text COLLATE utf8_bin,
  `InstallInstructions` text COLLATE utf8_bin,
  `FTPUser` varchar(50) COLLATE utf8_bin DEFAULT NULL,
  `FTPPassword` varchar(350) COLLATE utf8_bin DEFAULT NULL,
  `FTPUploadDirectory` varchar(350) COLLATE utf8_bin DEFAULT NULL,
  `Status` enum('New','Uploaded','Processing','Public','Verified','Rejected') COLLATE utf8_bin NOT NULL DEFAULT 'New',
  `FTPAccountEnabled` set('True','False') COLLATE utf8_bin NOT NULL DEFAULT 'True',
  `ContributionCreated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ProcessTime` timestamp NULL DEFAULT NULL,
  `ProcessBy` binary(16) DEFAULT NULL,
  `LinkedProduct` binary(16) DEFAULT NULL,
  `LinkedRelease` binary(16) DEFAULT NULL,
  `RejectionReason` text COLLATE utf8_bin,
  PRIMARY KEY (`ContributionUUID`),
  KEY `UserUUID` (`UserUUID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

-- Dumping data for table winworld.Contributions: ~0 rows (approximately)
/*!40000 ALTER TABLE `Contributions` DISABLE KEYS */;
/*!40000 ALTER TABLE `Contributions` ENABLE KEYS */;

-- Dumping structure for table winworld.DownloadHits
CREATE TABLE IF NOT EXISTS `DownloadHits` (
  `DownloadUUID` binary(16) NOT NULL,
  `MirrorUUID` binary(16) NOT NULL,
  `SessionUUID` binary(16) DEFAULT NULL,
  `UserUUID` binary(16) DEFAULT NULL,
  `IPAddress` varchar(46) COLLATE utf8_bin NOT NULL,
  `DownloadTime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `DownloadUUID` (`DownloadUUID`),
  KEY `UserUUID` (`UserUUID`),
  KEY `MirrorUUID` (`MirrorUUID`),
  KEY `DownloadTime` (`DownloadTime`),
  KEY `IPAddress` (`IPAddress`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

-- Dumping data for table winworld.DownloadHits: ~0 rows (approximately)
/*!40000 ALTER TABLE `DownloadHits` DISABLE KEYS */;
/*!40000 ALTER TABLE `DownloadHits` ENABLE KEYS */;

-- Dumping structure for table winworld.DownloadMirrors
CREATE TABLE IF NOT EXISTS `DownloadMirrors` (
  `MirrorUUID` binary(16) NOT NULL,
  `MirrorName` varchar(50) COLLATE utf8_bin NOT NULL,
  `Hostname` varchar(50) COLLATE utf8_bin DEFAULT NULL,
  `IsOnline` enum('True','False') COLLATE utf8_bin DEFAULT 'True',
  `Location` varchar(50) COLLATE utf8_bin DEFAULT NULL,
  `UnixUser` varchar(20) COLLATE utf8_bin DEFAULT NULL,
  `HomeDirectory` varchar(150) COLLATE utf8_bin DEFAULT NULL,
  `DownloadDirectory` varchar(150) COLLATE utf8_bin DEFAULT NULL,
  `Country` enum('FR','UK','US','JP','EU','CA') COLLATE utf8_bin DEFAULT NULL,
  `Webserver` enum('True','False') COLLATE utf8_bin NOT NULL DEFAULT 'False',
  `SSHFingerprint` varbinary(100) DEFAULT NULL,
  PRIMARY KEY (`MirrorUUID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

-- Dumping data for table winworld.DownloadMirrors: ~0 rows (approximately)
/*!40000 ALTER TABLE `DownloadMirrors` DISABLE KEYS */;
/*!40000 ALTER TABLE `DownloadMirrors` ENABLE KEYS */;

-- Dumping structure for table winworld.Downloads
CREATE TABLE IF NOT EXISTS `Downloads` (
  `DLUUID` binary(16) NOT NULL,
  `Name` varchar(150) COLLATE utf8_bin NOT NULL,
  `Version` varchar(40) COLLATE utf8_bin NOT NULL,
  `RTM` enum('True','False') COLLATE utf8_bin NOT NULL DEFAULT 'True',
  `OriginalPath` text COLLATE utf8_bin NOT NULL,
  `DownloadPath` text COLLATE utf8_bin NOT NULL,
  `ImageType` enum('Archive','35Floppy','525Floppy','CDISO','DVDISO','VPC','VMWARE','VBOX') COLLATE utf8_bin NOT NULL DEFAULT 'Archive',
  `Arch` set('x86','x86-32','m68k','ppc','amd64','mos6502','ppc64','SPARC','SPARC64','MIPS','MIPS64','Alpha','Other') COLLATE utf8_bin NOT NULL DEFAULT 'x86',
  `Information` text COLLATE utf8_bin,
  `ReleaseUUID` binary(16) DEFAULT NULL,
  `Upgrade` enum('True','False') COLLATE utf8_bin NOT NULL DEFAULT 'False',
  `VIPOnly` enum('True','False') COLLATE utf8_bin NOT NULL DEFAULT 'False',
  `Language` varchar(50) COLLATE utf8_bin NOT NULL DEFAULT 'English',
  `FileSize` bigint(20) DEFAULT NULL,
  `FileName` varchar(250) COLLATE utf8_bin DEFAULT NULL,
  `ContributionUUID` binary(16) DEFAULT NULL,
  `CreatedDate` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `LastUpdated` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `NoShowOnHome` enum('True','False') COLLATE utf8_bin NOT NULL DEFAULT 'False',
  `FileHash` varchar(255) COLLATE utf8_bin DEFAULT NULL,
  `IPFSPath` text COLLATE utf8_bin,
  PRIMARY KEY (`DLUUID`),
  KEY `ReleaseUUID` (`ReleaseUUID`),
  KEY `FileName` (`Name`),
  KEY `ContributionUUID` (`ContributionUUID`),
  KEY `NoShowOnHome` (`NoShowOnHome`),
  KEY `CreatedDate` (`CreatedDate`),
  KEY `LastUpdated` (`LastUpdated`),
  FULLTEXT KEY `Information` (`Information`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

-- Dumping data for table winworld.Downloads: ~0 rows (approximately)
/*!40000 ALTER TABLE `Downloads` DISABLE KEYS */;
/*!40000 ALTER TABLE `Downloads` ENABLE KEYS */;

-- Dumping structure for table winworld.MirrorContents
CREATE TABLE IF NOT EXISTS `MirrorContents` (
  `MirrorUUID` binary(16) DEFAULT NULL,
  `DownloadUUID` binary(16) DEFAULT NULL,
  KEY `UUIDS` (`MirrorUUID`,`DownloadUUID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

-- Dumping data for table winworld.MirrorContents: ~0 rows (approximately)
/*!40000 ALTER TABLE `MirrorContents` DISABLE KEYS */;
/*!40000 ALTER TABLE `MirrorContents` ENABLE KEYS */;

-- Dumping structure for table winworld.Products
CREATE TABLE IF NOT EXISTS `Products` (
  `ProductUUID` binary(16) NOT NULL,
  `DiscussionUUID` binary(16) NOT NULL,
  `Name` varchar(150) NOT NULL,
  `Slug` varchar(100) DEFAULT NULL,
  `Notes` text NOT NULL,
  `LogoImage` varchar(150) DEFAULT NULL,
  `Type` enum('OS','Game','Application','DevTool','System') NOT NULL DEFAULT 'Application',
  `ProductCreated` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `DefaultRelease` binary(16) DEFAULT NULL,
  `ApplicationTags` set('Word Processor','Spreadsheet','Presentations','Web Browser','Chat','Utility','Graphics','Publishing','Financial','Reference','Editor','Communications','Novelty','PIM','Video','Audio','Document','Media Player','Virtualization','Archive','Other','Server','Database','Mathematics','Planning','Education','Engineering') DEFAULT NULL,
  PRIMARY KEY (`ProductUUID`),
  KEY `Name_Slug` (`Name`,`Slug`),
  KEY `Type_Platform` (`Type`),
  KEY `DefaultRelease` (`DefaultRelease`),
  KEY `ApplicationTags` (`ApplicationTags`),
  KEY `DiscussionUUID` (`DiscussionUUID`),
  FULLTEXT KEY `Notes` (`Notes`),
  FULLTEXT KEY `Name_Notes` (`Name`,`Notes`),
  FULLTEXT KEY `Name` (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Dumping data for table winworld.Products: ~0 rows (approximately)
/*!40000 ALTER TABLE `Products` DISABLE KEYS */;
/*!40000 ALTER TABLE `Products` ENABLE KEYS */;

-- Dumping structure for table winworld.Releases
CREATE TABLE IF NOT EXISTS `Releases` (
  `ReleaseUUID` binary(16) NOT NULL,
  `ProductUUID` binary(16) NOT NULL,
  `Name` varchar(50) CHARACTER SET utf8 NOT NULL,
  `VendorName` varchar(50) CHARACTER SET utf8 DEFAULT NULL,
  `Slug` varchar(100) COLLATE utf8_bin DEFAULT NULL,
  `ReleaseOrder` int(11) NOT NULL DEFAULT '0',
  `ReleaseDate` timestamp NULL DEFAULT NULL,
  `EndOfLife` timestamp NULL DEFAULT NULL,
  `FuzzyDate` enum('True','False') COLLATE utf8_bin NOT NULL DEFAULT 'False',
  `Arch` set('x86','x86-32','m68k','ppc','amd64','mos6502','ppc64','SPARC','SPARC64','MIPS','MIPS64','Alpha','Other') COLLATE utf8_bin DEFAULT NULL,
  `RAMRequirement` int(10) unsigned DEFAULT NULL COMMENT 'in bytes',
  `CPURequirement` varchar(50) COLLATE utf8_bin DEFAULT NULL,
  `DiskSpaceRequired` int(10) unsigned DEFAULT NULL COMMENT 'in bytes',
  `MultiUser` enum('Yes','No') COLLATE utf8_bin NOT NULL DEFAULT 'No',
  `Networking` varchar(300) COLLATE utf8_bin DEFAULT NULL,
  `Type` enum('GUI','Text') COLLATE utf8_bin NOT NULL DEFAULT 'GUI',
  `SerialRequired` enum('True','False') COLLATE utf8_bin NOT NULL DEFAULT 'False',
  `InstallInstructions` longtext CHARACTER SET utf8,
  `Notes` longtext CHARACTER SET utf8,
  `Platform` set('DOS','CPM','Windows','OS2','Unix','Linux','MacOS','Mac OS X','DOSShell','Other') COLLATE utf8_bin DEFAULT NULL,
  `DefaultDownload` binary(16) DEFAULT NULL,
  PRIMARY KEY (`ReleaseUUID`),
  KEY `ProductUUID` (`ProductUUID`),
  KEY `Slug` (`Slug`),
  KEY `ReleaseDate_EndOfLife` (`ReleaseDate`,`EndOfLife`) USING BTREE,
  KEY `ReleaseOrder` (`ReleaseOrder`) USING BTREE,
  KEY `Platform` (`Platform`),
  KEY `Arch` (`Arch`),
  FULLTEXT KEY `Name_VendorName_InstallInstructions_Notes` (`InstallInstructions`,`Notes`,`Name`,`VendorName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

-- Dumping data for table winworld.Releases: ~0 rows (approximately)
/*!40000 ALTER TABLE `Releases` DISABLE KEYS */;
/*!40000 ALTER TABLE `Releases` ENABLE KEYS */;

-- Dumping structure for table winworld.Screenshots
CREATE TABLE IF NOT EXISTS `Screenshots` (
  `ScreenshotUUID` binary(16) NOT NULL,
  `ReleaseUUID` binary(16) DEFAULT NULL,
  `ScreenshotTitle` varchar(750) COLLATE utf8_bin DEFAULT NULL,
  `ScreenshotFile` varchar(350) COLLATE utf8_bin DEFAULT NULL,
  PRIMARY KEY (`ScreenshotUUID`),
  KEY `ReleaseUUID` (`ReleaseUUID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

-- Dumping data for table winworld.Screenshots: ~0 rows (approximately)
/*!40000 ALTER TABLE `Screenshots` DISABLE KEYS */;
/*!40000 ALTER TABLE `Screenshots` ENABLE KEYS */;

-- Dumping structure for table winworld.Serials
CREATE TABLE IF NOT EXISTS `Serials` (
  `ReleaseUUID` binary(16) DEFAULT NULL,
  `Serial` varchar(500) COLLATE utf8_bin DEFAULT NULL,
  KEY `ReleaseUUID` (`ReleaseUUID`) USING HASH
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

-- Dumping data for table winworld.Serials: ~0 rows (approximately)
/*!40000 ALTER TABLE `Serials` DISABLE KEYS */;
/*!40000 ALTER TABLE `Serials` ENABLE KEYS */;

-- Dumping structure for table winworld.UserFlagHolders
CREATE TABLE IF NOT EXISTS `UserFlagHolders` (
  `FlagUUID` binary(16) NOT NULL,
  `UserUUID` binary(16) NOT NULL,
  `Added` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `GroupUUID` (`FlagUUID`),
  KEY `UserUUID` (`UserUUID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

-- Dumping data for table winworld.UserFlagHolders: ~2 rows (approximately)
/*!40000 ALTER TABLE `UserFlagHolders` DISABLE KEYS */;
INSERT IGNORE INTO `UserFlagHolders` (`FlagUUID`, `UserUUID`, `Added`) VALUES
	(_binary 0x11E99BFCD1E51F4C853FE86A64A6C64B, _binary 0x11E99BFCD1E9E3F7853FE86A64A6C64B, NOW());
/*!40000 ALTER TABLE `UserFlagHolders` ENABLE KEYS */;

-- Dumping structure for table winworld.UserFlags
CREATE TABLE IF NOT EXISTS `UserFlags` (
  `FlagUUID` binary(16) NOT NULL,
  `FlagName` varchar(15) NOT NULL,
  `LongName` varchar(250) NOT NULL,
  `SystemFlag` enum('True','False') NOT NULL DEFAULT 'False',
  `Preemptive` enum('True','False') NOT NULL DEFAULT 'False',
  `PublicVisible` enum('True','False') NOT NULL DEFAULT 'False',
  `FlagColour` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`FlagUUID`),
  UNIQUE KEY `FlagName` (`FlagName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Dumping data for table winworld.UserFlags: ~2 rows (approximately)
/*!40000 ALTER TABLE `UserFlags` DISABLE KEYS */;
INSERT IGNORE INTO `UserFlags` (`FlagUUID`, `FlagName`, `LongName`, `SystemFlag`, `Preemptive`, `PublicVisible`, `FlagColour`) VALUES
	(_binary 0x11E99BFCD1E51F4C853FE86A64A6C64B, 'sa', 'Site Admin', 'True', 'False', 'True', 'primary'),
	(_binary 0x11E99BFCD1E77AC6853FE86A64A6C64B, 'vip', 'VIP Member', 'False', 'False', 'True', 'success');
/*!40000 ALTER TABLE `UserFlags` ENABLE KEYS */;

-- Dumping structure for table winworld.UserRecoverPasswordRequests
CREATE TABLE IF NOT EXISTS `UserRecoverPasswordRequests` (
  `RequestID` binary(16) NOT NULL,
  `UserID` binary(16) NOT NULL,
  `DateCreated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`RequestID`),
  UNIQUE KEY `UserID` (`UserID`),
  UNIQUE KEY `RequestID` (`RequestID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Dumping data for table winworld.UserRecoverPasswordRequests: ~0 rows (approximately)
/*!40000 ALTER TABLE `UserRecoverPasswordRequests` DISABLE KEYS */;
/*!40000 ALTER TABLE `UserRecoverPasswordRequests` ENABLE KEYS */;

-- Dumping structure for table winworld.Users
CREATE TABLE IF NOT EXISTS `Users` (
  `UserID` binary(16) NOT NULL,
  `Email` varchar(80) COLLATE utf8_unicode_ci NOT NULL,
  `AccountEnabled` enum('True','False') COLLATE utf8_unicode_ci NOT NULL DEFAULT 'True',
  `Password` varchar(64) COLLATE utf8_unicode_ci NOT NULL,
  `Salt` varchar(64) COLLATE utf8_unicode_ci DEFAULT NULL,
  `ShortName` varchar(64) COLLATE utf8_unicode_ci DEFAULT NULL,
  `RegistrationTime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `LastSeenTime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `RegistrationIP` varchar(45) COLLATE utf8_unicode_ci NOT NULL,
  `ThemeName` varchar(50) COLLATE utf8_unicode_ci NOT NULL DEFAULT 'default',
  PRIMARY KEY (`UserID`),
  UNIQUE KEY `UniqueVals` (`ShortName`,`Email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- Dumping data for table winworld.Users: ~0 rows (approximately)
/*!40000 ALTER TABLE `Users` DISABLE KEYS */;
INSERT IGNORE INTO `Users` (`UserID`, `Email`, `AccountEnabled`, `Password`, `Salt`, `ShortName`, `RegistrationTime`, `LastSeenTime`, `RegistrationIP`, `ThemeName`) VALUES
	(_binary 0x11E99BFCD1E9E3F7853FE86A64A6C64B, 'root@localhost', 'True', '$2a$12$I7Z0lrQFyxgRFgWVB8FX1.FYpJDEN7Z5x4Mp4a7I8bT26G3OU8USa', '', 'admin', NOW(), NOW(), '', 'default');
/*!40000 ALTER TABLE `Users` ENABLE KEYS */;

-- Dumping structure for function winworld.UUIDBIN
DELIMITER //
CREATE DEFINER=`root`@`localhost` FUNCTION `UUIDBIN`(_uuid BINARY(36)) RETURNS binary(16)
    DETERMINISTIC
    SQL SECURITY INVOKER
RETURN
        UNHEX(CONCAT(
            SUBSTR(_uuid, 15, 4),
            SUBSTR(_uuid, 10, 4),
            SUBSTR(_uuid,  1, 8),
            SUBSTR(_uuid, 20, 4),
            SUBSTR(_uuid, 25) ))//
DELIMITER ;

-- Dumping structure for trigger winworld.BeforeCreateContribution
SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE TRIGGER `BeforeCreateContribution` BEFORE INSERT ON `Contributions` FOR EACH ROW BEGIN
SET NEW.ContributionUUID = UUIDBIN(UUID());
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;

-- Dumping structure for trigger winworld.BeforeCreateDownload
SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE TRIGGER `BeforeCreateDownload` BEFORE INSERT ON `Downloads` FOR EACH ROW BEGIN
SET New.DLUUID = UUIDBIN(UUID());
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;

-- Dumping structure for trigger winworld.BeforeCreateFlags
SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE TRIGGER `BeforeCreateFlags` BEFORE INSERT ON `UserFlags` FOR EACH ROW BEGIN
SET NEW.FlagUUID = UUIDBIN(UUID());
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;

-- Dumping structure for trigger winworld.BeforeCreateMirror
SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE TRIGGER `BeforeCreateMirror` BEFORE INSERT ON `DownloadMirrors` FOR EACH ROW BEGIN
SET NEW.MirrorUUID = UUIDBIN(UUID());
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;

-- Dumping structure for trigger winworld.BeforeCreateProduct
SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE TRIGGER `BeforeCreateProduct` BEFORE INSERT ON `Products` FOR EACH ROW BEGIN
SET NEW.ProductUUID = UUIDBIN(UUID());
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;

-- Dumping structure for trigger winworld.BeforeCreateRecoverPassword
SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE TRIGGER `BeforeCreateRecoverPassword` BEFORE INSERT ON `UserRecoverPasswordRequests` FOR EACH ROW BEGIN
	SET NEW.RequestID = UUIDBIN(UUID());
	SET NEW.DateCreated = NOW();
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;

-- Dumping structure for trigger winworld.BeforeCreateRelease
SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE TRIGGER `BeforeCreateRelease` BEFORE INSERT ON `Releases` FOR EACH ROW BEGIN
SET NEW.ReleaseUUID = UUIDBIN(UUID());
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;

-- Dumping structure for trigger winworld.BeforeCreateScreenshot
SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE TRIGGER `BeforeCreateScreenshot` BEFORE INSERT ON `Screenshots` FOR EACH ROW BEGIN
SET NEW.ScreenshotUUID = UUIDBIN(UUID());
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;

-- Dumping structure for trigger winworld.BeforeCreateUser
SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE TRIGGER `BeforeCreateUser` BEFORE INSERT ON `Users` FOR EACH ROW BEGIN
	SET NEW.UserID = UUIDBIN(UUID());
	SET NEW.RegistrationTime = NOW();
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;

/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IF(@OLD_FOREIGN_KEY_CHECKS IS NULL, 1, @OLD_FOREIGN_KEY_CHECKS) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;

/* Begin non-dumped functions */
create or replace function ProductPlatforms
(productID binary(16))
returns set('DOS', 'CPM', 'Windows', 'OS2', 'Unix', 'Linux', 'MacOS', 'Mac OS X', 'DOSShell', 'Other') deterministic
begin
    declare prodPlat set('DOS', 'CPM', 'Windows', 'OS2', 'Unix', 'Linux', 'MacOS', 'Mac OS X', 'DOSShell', 'Other');
    set prodPlat = "";
    -- null/empty messes it up so just default
    select group_concat(distinct Platform)
        into prodPlat
        from Releases
        where productID = Releases.ProductUUID
            and Platform is not null
            and Platform <> "";
    return prodPlat;
end;
