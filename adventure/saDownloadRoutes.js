var express = require("express"),
    fs = require("fs"),
    path = require("path"),
    middleware = require("./middleware.js"),
    formatting = require("./formatting.js");

var config, database, sitePages;

var restrictedRoute = middleware.restrictedRoute;
var urlencodedParser = middleware.bodyParser;
var server = express.Router();

server.get("/sa/orphanedDownloads/", function (req, res) {
    database.execute("SELECT * FROM Downloads WHERE NOT EXISTS (SELECT 1 FROM Releases WHERE Downloads.ReleaseUUID = Releases.ReleaseUUID)", [], function (dlErr, dlRes, dlFields) {
        return res.render("saOrphanedDownloads", {
            orphans: dlRes.map(function (x) {
                x.DLUUID = formatting.binToHex(x.DLUUID);
                return x;
            })
        });
    });
});

server.get("/sa/deleteDownload/:download", restrictedRoute("sa"), function (req, res) {
    if (req.params.download && formatting.isHexString(req.params.download) && req.query && req.query.yesPlease) {
        var uuidAsBuf = formatting.hexToBin(req.params.download);
        
        database.execute("DELETE FROM MirrorContents WHERE DownloadUUID = ?", [uuidAsBuf], function (mcErr, mcRes, mcFields) {
            if (mcErr) {
                return res.status(500).render("error", {
                    message: "There was an error removing mirror presence information."
                });
            } else {
                database.execute("DELETE FROM Downloads WHERE DLUUID = ?", [uuidAsBuf], function (dlErr, dlRes, dlFields) {
                    if (dlErr) {
                        return res.status(500).render("error", {
                            message: "There was an error removing the download."
                        });
                    } else {
                        // TODO: Come up with a better redirect
                        return res.redirect("/library");
                    }
                });
            }
        });
    } else {
        return res.status(400).render("error", {
            message: "The request was malformed, or you weren't certain."
        });
    }
});

server.get("/sa/download/:download", restrictedRoute("sa"), function (req, res) {
    database.execute("SELECT * FROM `Downloads` WHERE `DLUUID` = ?", [formatting.hexToBin(req.params.download)], function (dlErr, dlRes, dlFields) {
        var download = dlRes[0] || null;
        if (dlErr || download == null) {
            res.status(404).render("error", {
                message: "There is no product."
            });
        }
        database.execute("SELECT * FROM `MirrorContents` WHERE `DownloadUUID` = ?", [download.DLUUID], function (mrErr, mrRes, mrFields) {
            //  WHERE `IsOnline` = True
            database.execute("SELECT * FROM `DownloadMirrors`", null, function (miErr, miRes, miFields) {
                // for attachment dropdown; should also order releases when grouped too
                database.execute("SELECT Releases.Name AS ReleaseName,Releases.ReleaseUUID AS ReleaseUUID,Products.Name AS ProductName FROM Products JOIN Releases USING(ProductUUID) ORDER BY Products.Name", null, function (prErr, prRes, prFields) {
                    download.DLUUID = formatting.binToHex(download.DLUUID);
                    download.ReleaseUUID = download.ReleaseUUID ? formatting.binToHex(download.ReleaseUUID) : null;
                    var mirrors = miRes.map(function (x) {
                        x.MirrorUUID = formatting.binToHex(x.MirrorUUID);
                        return x;
                    });
                    var mirrorContents = mrRes.map(function (x) {
                        x.MirrorUUID = formatting.binToHex(x.MirrorUUID);
                        return x;
                    });
                    var availReleases = formatting.groupBy(prRes.map(function (x) {
                        x.ReleaseUUID = formatting.binToHex(x.ReleaseUUID);
                        return x;
                    }), "ProductName");

                    return res.render("saDownload", {
                        download: download,
                        mirrors: mirrors,
                        mirrorContents: mirrorContents,
                        availReleases: availReleases,
                        fileTypeMappings: config.constants.fileTypeMappings,
                        fileTypeMappingsInverted: formatting.invertObject(config.constants.fileTypeMappings),
                    });
                });
            });
        });
    });
});

server.post("/sa/editDownloadMetadata/:download", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    if (req.body && req.params.download && formatting.isHexString(req.params.download) && formatting.isHexString(req.body.releaseUUID) && /^[0-9A-Fa-f]{40}$/.test(req.body.sha1Sum)) {
        var uuid = req.params.download;
        var releaseUuidAsBuf = formatting.hexToBin(req.body.releaseUUID);
        // HACK: oh god mysql2 isn't putting arrays into updates for sets properly?
        var arch = formatting.dbStringifySelect(req.body.arch);
        var rtm = req.body.rtm ? "True" : "False";
        var upgrade = req.body.upgrade ? "True" : "False";
        var sha1Sum = Buffer.from(req.body.sha1Sum, "hex");
        var dbParams = [releaseUuidAsBuf, req.body.name, arch, req.body.version, rtm, upgrade, req.body.information, req.body.language, req.body.imageType, req.body.fileSize, sha1Sum, req.body.downloadPath, req.body.downloadPath, req.body.fileName, new Date(), formatting.hexToBin(uuid)];
        database.execute("UPDATE Downloads SET ReleaseUUID = ?, Name = ?, Arch = ?, Version = ?, RTM = ?, Upgrade = ?, Information = ?, Language = ?, ImageType = ?, FileSize = ?, SHA1Sum = ?, DownloadPath = ?, OriginalPath = ?, FileName = ?, LastUpdated = ? WHERE DLUUID = ?", dbParams, function (rlErr, rlRes, rlFields) {
            if (rlErr) {
                return res.status(500).render("error", {
                    message: "The download could not be edited."
                });
            } else {
                return res.redirect("/download/" + uuid);
            }
        });
    } else {
        return res.status(400).render("error", {
            message: "The request was malformed."
        });
    }
});

server.get("/sa/downloadMirrorAvailability/:download/:mirror", restrictedRoute("sa"), function (req, res) {
    if (req.params.download && formatting.isHexString(req.params.download) && req.params.mirror && formatting.isHexString(req.params.mirror)) {
        var downloadUuidAsBuf = formatting.hexToBin(req.params.download);
        var mirrorUuidAsBuf = formatting.hexToBin(req.params.mirror);
        var dbParams = [mirrorUuidAsBuf, downloadUuidAsBuf];
        database.execute("SELECT * FROM MirrorContents WHERE MirrorUUID = ? && DownloadUUID = ?", dbParams, function (tsErr, tsRes, tsFields) {
            if (tsErr) {
                return res.status(500).render("error", {
                    message: "There was an error checking the database for availability."
                });
            } else if (tsRes.length == 0) {
                // create
                database.execute("INSERT INTO MirrorContents (MirrorUUID, DownloadUUID) VALUES (?, ?)", dbParams, function (inErr, inRes, inFields) {
                    if (inErr) {
                        return res.status(500).render("error", {
                            message: "There was an error making the download available."
                        });
                    } else {
                        return res.redirect("/sa/download/" + req.params.download);
                    }
                });
            } else {
                // delete
                database.execute("DELETE FROM MirrorContents WHERE MirrorUUID = ? && DownloadUUID = ?", dbParams, function (deErr, deRes, deFields) {
                    if (deErr) {
                        return res.status(500).render("error", {
                            message: "There was an error making the download unavailable."
                        });
                    } else {
                        return res.redirect("/sa/download/" + req.params.download);
                    }
                });
            }
        });
    } else {
        return res.status(400).render("error", {
            message: "The request was malformed."
        });
    }
});

server.get("/sa/createDownload/:release", restrictedRoute("sa"), function (req, res) {
    database.execute("SELECT * FROM `Releases` WHERE `ReleaseUUID` = ?", [formatting.hexToBin(req.params.release)], function (rlErr, rlRes, rlFields) {
        var release = rlRes[0] || null;
        if (rlErr || release == null) {
            return res.status(404).render("error", {
                message: "There is no release."
            });
        }
        release.ReleaseUUID = formatting.binToHex(release.ReleaseUUID);
        return res.render("saCreateDownload", {
            release: release,
        });
    });
});

server.post("/sa/createDownload/:release", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    const getNewProductQuery = "SELECT * FROM `Downloads` WHERE `ReleaseUUID` = ? && `Name` = ? && `Version` = ? && `DownloadPath` = ? && `OriginalPath` = ? && `FileName` = ? && `SHA1Sum` = ?";
    
    if (req.body && req.params.release && formatting.isHexString(req.params.release) && req.body.downloadPath && req.body.name && req.body.version && /^[0-9A-Fa-f]{40}$/.test(req.body.sha1Sum)) {
        // check for dupe
        var uuidAsBuf = formatting.hexToBin(req.params.release);
        var downloadPath = req.body.downloadPath;
        var fileName = path.basename(downloadPath);
        var name = req.body.name;
        var version = req.body.version
        var sha1Sum = Buffer.from(req.body.sha1Sum, "hex");
        var dbParams = [uuidAsBuf, name, version, downloadPath, downloadPath, fileName, sha1Sum];
        
        database.execute(getNewProductQuery, dbParams, function (dbErr, dbRes, dbFields) {
            if (dbErr || dbRes == null) {
                return res.status(500).render("error", {
                    message: "There was an error checking the database."
                });
            } else if (dbRes.length > 0) {
                return res.status(409).render("error", {
                    message: "There is already a download with these attributes."
                });
            } else {
                database.execute("INSERT INTO Downloads (ReleaseUUID, Name, Version, DownloadPath, OriginalPath, FileName, SHA1Sum) VALUES (?, ?, ?, ?, ?, ?, ?)", dbParams, function (inErr, inRes, inFields) {
                    if (inErr) {
                        return res.status(500).render("error", {
                            message: "There was an error creating the item."
                        });
                    } else {
                        database.execute(getNewProductQuery, dbParams, function (rlErr, rlRes, rlFields) {
                            if (rlErr || rlRes == null || rlRes.length == 0) {
                                return res.status(500).render("error", {
                                    message: "There was an error validating the item."
                                });
                            } else {
                                return res.redirect("/download/" + formatting.binToHex(rlRes[0].DLUUID));
                            }
                        });
                    }
                });
            }
        });
    } else {
        return res.status(400).render("error", {
            message: "The request was malformed."
        });
    }
});

module.exports = function (c, d, p) {
    config = c
    database = d;
    sitePages = p;

    return server;
}
