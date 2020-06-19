var express = require("express"),
    fs = require("fs"),
    path = require("path"),
    middleware = require("./middleware.js"),
    formatting = require("./formatting.js");

var config, database, sitePages;

var restrictedRoute = middleware.restrictedRoute;
var urlencodedParser = middleware.bodyParser;
var server = express.Router();

server.get("/sa/architectures", function (req, res) {
    database.execute("SELECT * From Architecture", [], function (arErr, arRes) {
        var architectures = arRes.map(function (x) {
            x.ArchitectureUUID = formatting.binToHex(x.ArchitectureUUID);
            return x;
        });
        return res.render("saArchitectures", {
            architectures: architectures
        });
    });
});

server.get("/sa/deleteArchitecture/:architecture", restrictedRoute("sa"), function (req, res) {
    var architecture = formatting.hexToBin(req.params.architecture);
    // XXX: Wrap in transaction?
    database.execute("DELETE FROM DownloadArchitectures WHERE ArchitectureUUID = ?", [architecture], function (updateError) {
        if (updateError) {
            return res.status(500).render("error", {
                message: "There was an error disassociating the downloads from the architecture type."
            });
        }
        database.execute("DELETE FROM Architecture WHERE ArchitectureUUID = ?", [mediaType], function (deleteError) {
            if (updateError) {
                return res.status(500).render("error", {
                    message: "There was an error deleting the architecture."
                });
            }
            res.redirect("/sa/architectures");
        });
    });
});

server.post("/sa/createArchitecture", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    var friendlyName = req.body.friendly;
    var shortName = req.body.shortName;
    database.execute("INSERT INTO Architecture (FriendlyName, ShortName) VALUES (?, ?)", [friendlyName, shortName], function (insertError) {
        if (insertError) {
            return res.status(500).render("error", {
                message: "There was an error creating the architecture."
            });
        }
        res.redirect("/sa/architectures");
    });
});

server.get("/sa/mediaTypes", function (req, res) {
    database.execute("SELECT * From MediaType", [], function (mtErr, mtRes) {
        var mediaTypes = mtRes.map(function (x) {
            x.MediaTypeUUID = formatting.binToHex(x.MediaTypeUUID);
            return x;
        });
        return res.render("saMediaTypes", {
            mediaTypes: mediaTypes
        });
    });
});

server.get("/sa/deleteMediaType/:mediaType", restrictedRoute("sa"), function (req, res) {
    // reset all the consumed media types to NULL (displayed as none)
    // then we can delete it (referential integrity, duh)
    var mediaType = formatting.hexToBin(req.params.mediaType);
    // XXX: Wrap in transaction?
    database.execute("DELETE FROM DownloadMediaType WHERE MediaTypeUUID = ?", [mediaType], function (updateError) {
        if (updateError) {
            return res.status(500).render("error", {
                message: "There was an error disassociating the downloads from the media type."
            });
        }
        database.execute("DELETE FROM MediaType WHERE MediaTypeUUID = ?", [mediaType], function (deleteError) {
            if (updateError) {
                return res.status(500).render("error", {
                    message: "There was an error deleting the architecture."
                });
            }
            res.redirect("/sa/mediaTypes");
        });
    });
});

server.post("/sa/createMediaType", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    var friendlyName = req.body.friendly;
    var shortName = req.body.shortName;
    database.execute("INSERT INTO MediaType (FriendlyName, ShortName) VALUES (?, ?)", [friendlyName, shortName], function (insertError) {
        if (insertError) {
            return res.status(500).render("error", {
                message: "There was an error creating the media type."
            });
        }
        res.redirect("/sa/mediaTypes");
    });
});

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
                // the subquery in mediatype is for returning all mediatypes, but if the releaseuuid exists in DMT
                // XXX: These could be done asynchronously from each other
                database.execute("select mt.*, dmt.DLUUID is not null as `Has` from MediaType mt left join (select DLUUID, MediaTypeUUID from DownloadMediaType where DLUUID = ?) dmt on dmt.MediaTypeUUID = mt.MediaTypeUUID ORDER BY mt.FriendlyName", [download.DLUUID], function (mtErr, mtRes, mtFields) {
                database.execute("select a.*, da.DLUUID is not null as `Has` from Architecture a left join (select DLUUID, ArchitectureUUID from DownloadArchitecture where DLUUID = ?) da on da.ArchitectureUUID = a.ArchitectureUUID ORDER BY a.FriendlyName", [download.DLUUID], function (arErr, arRes, arFields) {
                database.execute("SELECT Releases.Name AS ReleaseName,Releases.ReleaseUUID AS ReleaseUUID,Products.Name AS ProductName FROM Products JOIN Releases USING(ProductUUID) ORDER BY Products.Name", null, function (prErr, prRes, prFields) {
                    download.DLUUID = formatting.binToHex(download.DLUUID);
                    download.MediaType = formatting.binToHex(download.MediaType);
                    download.ReleaseUUID = download.ReleaseUUID ? formatting.binToHex(download.ReleaseUUID) : null;
                    var mirrors = miRes.map(function (x) {
                        x.MirrorUUID = formatting.binToHex(x.MirrorUUID);
                        return x;
                    });
                    var mirrorContents = mrRes.map(function (x) {
                        x.MirrorUUID = formatting.binToHex(x.MirrorUUID);
                        return x;
                    });
                    var mediaTypes = mtRes.map(function (x) {
                        x.MediaTypeUUID = formatting.binToHex(x.MediaTypeUUID);
                        return x;
                    });
                    var architectures = arRes.map(function (x) {
                        x.ArchitectureUUID = formatting.binToHex(x.ArchitectureUUID);
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
                        mediaTypes: mediaTypes,
                        architectures: architectures
                    });
                });
                });
                });
            });
        });
    });
});

server.post("/sa/editDownloadMetadata/:download", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    if (req.body && req.params.download && formatting.isHexString(req.params.download) && formatting.isHexString(req.body.releaseUUID) /*&& /^[0-9A-Fa-f]{40}$/.test(req.body.sha1Sum)*/) {
        var uuid = req.params.download;
        var uuidAsBuf = formatting.hexToBin(uuid);
        var releaseUuidAsBuf = formatting.hexToBin(req.body.releaseUUID);
        var mediaTypes = formatting.alwaysArray(req.body.imageType);
        var arch = formatting.alwaysArray(req.body.arch);
        var rtm = req.body.rtm ? "True" : "False";
        var upgrade = req.body.upgrade ? "True" : "False";
        var dbParams = [releaseUuidAsBuf, req.body.name, req.body.version, rtm, upgrade, req.body.information, req.body.language, req.body.fileSize, req.body.downloadPath, req.body.downloadPath, req.body.fileName, new Date(), req.body.fileHash, req.body.ipfsPath, uuidAsBuf];
        database.execute("UPDATE Downloads SET ReleaseUUID = ?, Name = ?, Version = ?, RTM = ?, Upgrade = ?, Information = ?, Language = ?, FileSize = ?, DownloadPath = ?, OriginalPath = ?, FileName = ?, LastUpdated = ?, FileHash = ?, IPFSPath = ? WHERE DLUUID = ?", dbParams, function (rlErr, rlRes, rlFields) {
            if (rlErr) {
                return res.status(500).render("error", {
                    message: "The download could not be edited."
                });
            }
            // thanks, i hate it! if we were using Promise, it'd be easier to wait on .all
            var counter = mediaTypes.length + arch.length;
            var hadError = false;
            // now just delete and reinsert the sets. (XXX: Transaction?)
            database.execute("DELETE FROM DownloadMediaType WHERE DLUUID = ?", [uuidAsBuf], function(deleteErr) {
                if (deleteErr) {
                    hadError = true;
                }
                for (var i = 0; i < mediaTypes.length; i++) {
                    var mediaTypeAsBuf = formatting.hexToBin(mediaTypes[i]);
                    database.execute("INSERT INTO DownloadMediaType (DLUUID, MediaTypeUUID) VALUES (?, ?)", [uuidAsBuf, mediaTypeAsBuf], function (insertError) {
                        if (insertError) {
                            hadError = true;
                        }
                        counter--;
                    });
                }
            });
            database.execute("DELETE FROM DownloadArchitecture WHERE DLUUID = ?", [uuidAsBuf], function(deleteErr) {
                if (deleteErr) {
                    hadError = true;
                }
                for (var i = 0; i < arch.length; i++) {
                    var architectureAsBuf = formatting.hexToBin(arch[i]);
                    database.execute("INSERT INTO DownloadArchitecture (DLUUID, ArchitectureUUID) VALUES (?, ?)", [uuidAsBuf, architectureAsBuf], function (insertError) {
                        if (insertError) {
                            hadError = true;
                        }
                        counter--;
                    });
                }
            });
            while (counter > 0) {
                if (hadError) {
                    return res.status(500).render("error", {
                        message: "There was an error assigning the media types and architectures to the download."
                    });
                }
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
    const getNewProductQuery = "SELECT * FROM `Downloads` WHERE `ReleaseUUID` = ? && `Name` = ? && `Version` = ? && `DownloadPath` = ? && `OriginalPath` = ? && `FileName` = ? && `FileHash` = ?";
    
    if (req.body && req.params.release && formatting.isHexString(req.params.release) && req.body.downloadPath && req.body.name && req.body.version /*&& /^[0-9A-Fa-f]{40}$/.test(req.body.sha1Sum)*/) {
        var uuidAsBuf = formatting.hexToBin(req.params.release);
        var downloadPath = req.body.downloadPath;
        var fileName = path.basename(downloadPath);
        var name = req.body.name;
        var version = req.body.version;
        var fileHash = req.body.fileHash;
        var dbParams = [uuidAsBuf, name, version, downloadPath, downloadPath, fileName, fileHash];
        
        database.execute("INSERT INTO Downloads (ReleaseUUID, Name, Version, DownloadPath, OriginalPath, FileName, FileHash) VALUES (?, ?, ?, ?, ?, ?, ?)", dbParams, function (inErr, inRes, inFields) {
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
