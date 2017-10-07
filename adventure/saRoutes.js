var express = require("express"),
    bodyParser = require("body-parser"),
    path = require("path"),
    constants = require("./constants.js"),
    middleware = require("./middleware.js"),
    formatting = require("./formatting.js");

var config, database, sitePages;

var restrictedRoute = middleware.restrictedRoute;
var urlencodedParser = bodyParser.urlencoded({ extended: false })
var server = express.Router();

// Admin routes
// Use UUID because slug can change
// "SELECT * FROM Downloads WHERE NOT EXISTS (SELECT 1 FROM Releases WHERE Downloads.ReleaseUUID = Releases.ReleaseUUID)"

server.get("/sa/orphanedReleases/", function (req, res) {
    database.execute("SELECT * FROM Releases WHERE NOT EXISTS (SELECT 1 FROM Products WHERE Products.ProductUUID = Releases.ProductUUID)", [], function (rlErr, rlRes, rlFields) {
        return res.render("saOrphanedReleases", {
            sitePages: sitePages,
            user: req.user,
            
            orphans: rlRes.map(function (x) {
                x.ReleaseUUID = formatting.binToHex(x.ReleaseUUID);
                return x;
            })
        });
    });
});

server.get("/sa/orphanedDownloads/", function (req, res) {
    database.execute("SELECT * FROM Downloads WHERE NOT EXISTS (SELECT 1 FROM Releases WHERE Downloads.ReleaseUUID = Releases.ReleaseUUID)", [], function (dlErr, dlRes, dlFields) {
        return res.render("saOrphanedDownloads", {
            sitePages: sitePages,
            user: req.user,
            
            orphans: dlRes.map(function (x) {
                x.DLUUID = formatting.binToHex(x.DLUUID);
                return x;
            })
        });
    });
});

server.get("/sa/product/:product", restrictedRoute("sa"), function (req, res) {
    database.execute("SELECT * FROM `Products` WHERE `ProductUUID` = ?", [formatting.hexToBin(req.params.product)], function (prErr, prRes, prFields) {
        var product = prRes[0] || null;
        if (prErr || product == null) {
            res.status(404).render("error", {
                sitePages: sitePages,
                user: req.user,
                
                message: "There is no product."
            });
        }
        product.ProductUUID = formatting.binToHex(product.ProductUUID);
        return res.render("saProduct", {
            sitePages: sitePages,
            user: req.user,
            
            product: product,
            tagMappingsInverted: constants.tagMappingsInverted
        });
    });
});

server.post("/sa/editProductMetadata/:product", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    if (req.body && req.params.product && formatting.isHexString(req.params.product)) {
        var uuid = req.params.product;
        var dbParams = [req.body.name, req.body.slug, req.body.notes, req.body.type, req.body.applicationTags || "", formatting.hexToBin(uuid)];
        database.execute("UPDATE Products SET Name = ?, Slug = ?, Notes = ?, Type = ?, ApplicationTags = ? WHERE ProductUUID = ?", dbParams, function (prErr, prRes, prFields) {
            if (prErr) {
                return res.status(500).render("error", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "The product could not be edited."
                });
            } else {
                return res.redirect("/product/" + req.body.slug);
            }
        });
    } else {
        return res.status(404).render("error", {
            sitePages: sitePages,
            user: req.user,
            
            message: "The request was malformed."
        });
    }
});

server.get("/sa/release/:release", restrictedRoute("sa"), function (req, res) {
    database.execute("SELECT * FROM `Releases` WHERE `ReleaseUUID` = ?", [formatting.hexToBin(req.params.release)], function (rlErr, rlRes, rlFields) {
        // now get any perphiery stuff
        
        var release = rlRes[0] || null;
        if (rlErr || release == null) {
            return res.status(404).render("error", {
                sitePages: sitePages,
                user: req.user,
                
                message: "There is no release."
            });
        }
        database.execute("SELECT * FROM `Serials` WHERE `ReleaseUUID` = ?", [release.ReleaseUUID], function (seErr, seRes, seFields) {
            database.execute("SELECT * FROM `Screenshots` WHERE `ReleaseUUID` = ?", [release.ReleaseUUID], function (scErr, scRes, scFields) {
                release.ReleaseUUID = formatting.binToHex(release.ReleaseUUID);
                release.ProductUUID = formatting.binToHex(release.ProductUUID);
                var screenshots = scRes.map(function (x) {
                    x.ScreenshotFile = config.screenshotBaseUrl + x.ScreenshotFile;
                    return x;
                });
                return res.render("saRelease", {
                    sitePages: sitePages,
                    user: req.user,

                    release: release,
                    serials: seRes,
                    screenshots: scRes,
                    platformMappingsInverted: constants.platformMappingsInverted
                });
            });
        });
    });
});

server.post("/sa/editReleaseMetadata/:release", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    if (req.body && req.params.release && formatting.isHexString(req.params.release) && formatting.isHexString(req.body.productUUID)) {
        var uuid = req.params.release;
        var productUuidAsBuf = formatting.hexToBin(req.body.productUUID);
        var platform = req.body.platform || "";
        var releaseDate = req.body.releaseDate ? new Date(req.body.releaseDate) : null;
        var endOfLife = req.body.endOfLife ? new Date(req.body.endOfLife) : null;
        var fuzzyDate = req.body.fuzzyDate ? "True" : "False";
        var ramRequirement = req.body.ramRequirement || 0;
        var diskSpaceRequired = req.body.diskSpaceRequired || 0;
        var dbParams = [productUuidAsBuf, req.body.name, req.body.vendorName, req.body.slug, req.body.notes, req.body.installInstructions, platform, req.body.type, releaseDate, endOfLife, fuzzyDate, req.body.cpuRequirement, ramRequirement, diskSpaceRequired, formatting.hexToBin(uuid)];
        database.execute("UPDATE Releases SET ProductUUID = ?, Name = ?, VendorName = ?, Slug = ?, Notes = ?, InstallInstructions = ?, Platform = ?, Type = ?, ReleaseDate = ?, EndOfLife = ?, FuzzyDate = ?, CPURequirement = ?, RAMRequirement = ?, DiskSpaceRequired = ? WHERE ReleaseUUID = ?", dbParams, function (rlErr, rlRes, rlFields) {
            if (rlErr) {
                return res.status(500).render("error", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "The release could not be edited."
                });
            } else {
                return res.redirect("/release/" + uuid);
            }
        });
    } else {
        return res.status(400).render("error", {
            sitePages: sitePages,
            user: req.user,
            
            message: "The request was malformed."
        });
    }
});

server.post("/sa/addSerial/:release", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    if (req.body && req.params.release && formatting.isHexString(req.params.release) && req.body.serial) {
        var uuid = req.params.release;
        var uuidAsBuf = formatting.hexToBin(uuid);
        database.execute("INSERT INTO `Serials` (ReleaseUUID, Serial) VALUES (?, ?)", [uuidAsBuf, req.body.serial], function (seErr, seRes, seFields) {
            if (seErr) {
                return res.status(500).render("error", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "The serial could not be added."
                });
            } else {
                return res.redirect("/sa/release/" + uuid);
            }
        });
    } else {
        return res.status(400).render("error", {
            sitePages: sitePages,
            user: req.user,
            
            message: "The request was malformed."
        });
    }
});

server.get("/sa/removeSerial/:release/:serial", restrictedRoute("sa"), function (req, res) {
    if (req.params.release && formatting.isHexString(req.params.release) && req.params.serial) {
        var uuid = req.params.release;
        var uuidAsBuf = formatting.hexToBin(uuid);
        var serial = decodeURIComponent(req.params.serial);
        database.execute("DELETE FROM Serials WHERE ReleaseUUID = ? && Serial = ?", [uuidAsBuf, serial], function (seErr, seRes, seFields) {
            if (seErr) {
                return res.status(500).render("error", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "The serial could not be removed."
                });
            } else {
                return res.redirect("/sa/release/" + uuid);
            }
        });
    } else {
        return res.status(400).render("error", {
            sitePages: sitePages,
            user: req.user,
            
            message: "The request was malformed."
        });
    }
});

server.get("/sa/createRelease/:product", restrictedRoute("sa"), function (req, res) {
    database.execute("SELECT * FROM `Products` WHERE `ProductUUID` = ?", [formatting.hexToBin(req.params.product)], function (prErr, prRes, prFields) {
        var product = prRes[0] || null;
        if (prErr || product == null) {
            return res.status(404).render("error", {
                sitePages: sitePages,
                user: req.user,
                
                message: "There is no product."
            });
        }
        product.ProductUUID = formatting.binToHex(product.ProductUUID);
        return res.render("saCreateRelease", {
            sitePages: sitePages,
            user: req.user,
            
            product: product,
        });
    });
});

server.post("/sa/createRelease/:product", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    const getNewProductQuery = "SELECT * FROM `Releases` WHERE `ProductUUID` = ? && `Name` = ? && `Slug` = ?";
    
    if (req.body && req.params.product && formatting.isHexString(req.params.product) && req.body.slug && req.body.name) {
        // check for dupe
        var uuidAsBuf = formatting.hexToBin(req.params.product);
        var slug = req.body.slug;
        var name = req.body.name;
        var dbParams = [uuidAsBuf, name, slug];
        database.execute(getNewProductQuery, dbParams, function (dbErr, dbRes, dbFields) {
            if (dbErr || dbRes == null) {
                return res.status(500).render("error", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "There was an error checking the database."
                });
            } else if (dbRes.length > 0) {
                return res.status(409).render("error", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "There is already a release with that slug."
                });
            } else {
                database.execute("INSERT INTO Releases (ProductUUID, Name, Slug) VALUES (?, ?, ?)", dbParams, function (inErr, inRes, inFields) {
                    if (inErr) {
                        return res.status(500).render("error", {
                            sitePages: sitePages,
                            user: req.user,
                            
                            message: "There was an error creating the item."
                        });
                    } else {
                        database.execute(getNewProductQuery, dbParams, function (rlErr, rlRes, rlFields) {
                            if (rlErr || rlRes == null || rlRes.length == 0) {
                                return res.status(500).render("error", {
                                    sitePages: sitePages,
                                    user: req.user,
                                    
                                    message: "There was an error validating the item."
                                });
                            } else {
                                return res.redirect("/release/" + formatting.binToHex(rlRes[0].ReleaseUUID));
                            }
                        });
                    }
                });
            }
        });
    } else {
        return res.status(400).render("error", {
            sitePages: sitePages,
            user: req.user,
            
            message: "The request was malformed."
        });
    }
});

server.get("/sa/deleteProduct/:product", restrictedRoute("sa"), function (req, res) {
    if (req.params.product && formatting.isHexString(req.params.product) && req.query && req.query.yesPlease) {
        var uuidAsBuf = formatting.hexToBin(req.params.product);
        
        database.execute("DELETE FROM Products WHERE ProductUUID = ?", [uuidAsBuf], function (prErr, prRes, prFields) {
            if (prErr) {
                return res.status(500).render("error", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "There was an error removing the product."
                });
            } else {
                return res.redirect("/library");
            }
        });
    } else {
        return res.status(400).render("error", {
            sitePages: sitePages,
            user: req.user,
            
            message: "The request was malformed, or you weren't certain."
        });
    }
});


server.get("/sa/deleteRelease/:release", restrictedRoute("sa"), function (req, res) {
    if (req.params.release && formatting.isHexString(req.params.release) && req.query && req.query.yesPlease) {
        var uuidAsBuf = formatting.hexToBin(req.params.release);
        
        database.execute("DELETE FROM Serials WHERE ReleaseUUID = ?", [uuidAsBuf], function (seErr, seRes, seFields) {
            if (seErr) {
                return res.status(500).render("error", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "There was an error removing serials."
                });
            } else {
                database.execute("DELETE FROM Screenshots WHERE ReleaseUUID = ?", [uuidAsBuf], function (scErr, scRes, scFields) {
                    // TODO: Actually delete files (could be too destructive though)
                    if (scErr) {
                        return res.status(500).render("error", {
                            sitePages: sitePages,
                            user: req.user,
                            
                            message: "There was an error removing screenshots."
                        });
                    } else {
                        database.execute("DELETE FROM Releases WHERE ReleaseUUID = ?", [uuidAsBuf], function (rlErr, rlRes, rlFields) {
                            if (rlErr) {
                                return res.status(500).render("error", {
                                    sitePages: sitePages,
                                    user: req.user,
                                    
                                    message: "There was an error removing the release."
                                });
                            } else {
                                // TODO: Come up with a better redirect
                                return res.redirect("/library");
                            }
                        });
                    }
                });
            }
        });
    } else {
        return res.status(400).render("error", {
            sitePages: sitePages,
            user: req.user,
            
            message: "The request was malformed, or you weren't certain."
        });
    }
});

server.get("/sa/deleteDownload/:download", restrictedRoute("sa"), function (req, res) {
    if (req.params.download && formatting.isHexString(req.params.download) && req.query && req.query.yesPlease) {
        var uuidAsBuf = formatting.hexToBin(req.params.download);
        
        database.execute("DELETE FROM MirrorContents WHERE DownloadUUID = ?", [uuidAsBuf], function (mcErr, mcRes, mcFields) {
            if (mcErr) {
                return res.status(500).render("error", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "There was an error removing mirror presence information."
                });
            } else {
                database.execute("DELETE FROM Downloads WHERE DLUUID = ?", [uuidAsBuf], function (dlErr, dlRes, dlFields) {
                    if (dlErr) {
                        return res.status(500).render("error", {
                            sitePages: sitePages,
                            user: req.user,
                            
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
            sitePages: sitePages,
            user: req.user,
            
            message: "The request was malformed, or you weren't certain."
        });
    }
});

server.get("/sa/createProduct", restrictedRoute("sa"), function (req, res) {
    return res.render("saCreateProduct", {
        sitePages: sitePages,
        user: req.user,
    });
});

server.post("/sa/createProduct", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    const getNewProductQuery = "SELECT * FROM `Products` WHERE `Name` = ? && `Slug` = ?";
    
    if (req.body && req.body.slug && req.body.name) {
        // check for dupe
        var slug = req.body.slug;
        var name = req.body.name;
        var dbParams = [name, slug];
        database.execute(getNewProductQuery, dbParams, function (dbErr, dbRes, dbFields) {
            if (dbErr || dbRes == null) {
                return res.status(500).render("error", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "There was an error checking the database."
                });
            } else if (dbRes.length > 0) {
                return res.status(409).render("error", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "There is already a product with that slug."
                });
            } else {
                // HACK: for old DB structure
                database.execute("INSERT INTO Products (Name, Slug, Type, Notes, DiscussionUUID) VALUES (?, ?, 'Application', '', 0x00000000000000000000000000000000)", dbParams, function (inErr, inRes, inFields) {
                    if (inErr) {
                        return res.status(500).render("error", {
                            sitePages: sitePages,
                            user: req.user,
                            
                            message: "There was an error creating the item."
                        });
                    } else {
                        database.execute(getNewProductQuery, dbParams, function (prErr, prRes, prFields) {
                            if (prErr || prRes == null || prRes.length == 0) {
                                return res.status(500).render("error", {
                                    sitePages: sitePages,
                                    user: req.user,
                                    
                                    message: "There was an error validating the item."
                                });
                            } else {
                                return res.redirect("/product/" + prRes[0].Slug);
                            }
                        });
                    }
                });
            }
        });
    } else {
        return res.status(400).render("error", {
            sitePages: sitePages,
            user: req.user,
            
            message: "The request was malformed."
        });
    }
});

server.get("/sa/download/:download", restrictedRoute("sa"), function (req, res) {
    database.execute("SELECT * FROM `Downloads` WHERE `DLUUID` = ?", [formatting.hexToBin(req.params.download)], function (dlErr, dlRes, dlFields) {
        var download = dlRes[0] || null;
        if (dlErr || download == null) {
            res.status(404).render("error", {
                sitePages: sitePages,
                user: req.user,
                
                message: "There is no product."
            });
        }
        database.execute("SELECT * FROM `MirrorContents` WHERE `DownloadUUID` = ?", [download.DLUUID], function (mrErr, mrRes, mrFields) {
            //  WHERE `IsOnline` = True
            database.execute("SELECT * FROM `DownloadMirrors`", null, function (miErr, miRes, miFields) {
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
                
                return res.render("saDownload", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    download: download,
                    mirrors: mirrors,
                    mirrorContents: mirrorContents,
                    fileTypeMappings: constants.fileTypeMappings,
                    fileTypeMappingsInverted: constants.fileTypeMappingsInverted,
                });
            });
        });
    });
});

server.post("/sa/editDownloadMetadata/:download", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    if (req.body && req.params.download && formatting.isHexString(req.params.download) && formatting.isHexString(req.body.releaseUUID) && /^[0-9a-f]{40}$/.test(req.body.sha1Sum)) {
        var uuid = req.params.download;
        var releaseUuidAsBuf = formatting.hexToBin(req.body.releaseUUID);
        var arch = req.body.arch || "";
        var rtm = req.body.rtm ? "True" : "False";
        var upgrade = req.body.upgrade ? "True" : "False";
        var sha1Sum = Buffer.from(req.body.sha1Sum, "hex");
        var dbParams = [releaseUuidAsBuf, req.body.name, arch, req.body.version, rtm, upgrade, req.body.information, req.body.language, req.body.imageType, req.body.fileSize, sha1Sum, req.body.downloadPath, req.body.downloadPath, req.body.fileName, formatting.hexToBin(uuid)];
        database.execute("UPDATE Downloads SET ReleaseUUID = ?, Name = ?, Arch = ?, Version = ?, RTM = ?, Upgrade = ?, Information = ?, Language = ?, ImageType = ?, FileSize = ?, SHA1Sum = ?, DownloadPath = ?, OriginalPath = ?, FileName = ? WHERE DLUUID = ?", dbParams, function (rlErr, rlRes, rlFields) {
            if (rlErr) {
                return res.status(500).render("error", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "The download could not be edited."
                });
            } else {
                return res.redirect("/download/" + uuid);
            }
        });
    } else {
        return res.status(400).render("error", {
            sitePages: sitePages,
            user: req.user,
            
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
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "There was an error checking the database for availability."
                });
            } else if (tsRes.length == 0) {
                // create
                database.execute("INSERT INTO MirrorContents (MirrorUUID, DownloadUUID) VALUES (?, ?)", dbParams, function (inErr, inRes, inFields) {
                    if (inErr) {
                        return res.status(500).render("error", {
                            sitePages: sitePages,
                            user: req.user,
                            
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
                            sitePages: sitePages,
                            user: req.user,
                            
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
            sitePages: sitePages,
            user: req.user,
            
            message: "The request was malformed."
        });
    }
});

server.get("/sa/createDownload/:release", restrictedRoute("sa"), function (req, res) {
    database.execute("SELECT * FROM `Releases` WHERE `ReleaseUUID` = ?", [formatting.hexToBin(req.params.release)], function (rlErr, rlRes, rlFields) {
        var release = rlRes[0] || null;
        if (rlErr || release == null) {
            return res.status(404).render("error", {
                sitePages: sitePages,
                user: req.user,
                
                message: "There is no release."
            });
        }
        release.ReleaseUUID = formatting.binToHex(release.ReleaseUUID);
        return res.render("saCreateDownload", {
            sitePages: sitePages,
            user: req.user,
            
            release: release,
        });
    });
});

server.post("/sa/createDownload/:release", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    const getNewProductQuery = "SELECT * FROM `Downloads` WHERE `ReleaseUUID` = ? && `Name` = ? && `Version` = ? && `DownloadPath` = ? && `OriginalPath` = ? && `FileName` = ? && `SHA1Sum` = ?";
    
    if (req.body && req.params.release && formatting.isHexString(req.params.release) && req.body.downloadPath && req.body.name && req.body.version && /^[0-9a-f]{40}$/.test(req.body.sha1Sum)) {
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
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "There was an error checking the database."
                });
            } else if (dbRes.length > 0) {
                return res.status(409).render("error", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "There is already a download with these attributes."
                });
            } else {
                database.execute("INSERT INTO Downloads (ReleaseUUID, Name, Version, DownloadPath, OriginalPath, FileName, SHA1Sum) VALUES (?, ?, ?, ?, ?, ?, ?)", dbParams, function (inErr, inRes, inFields) {
                    if (inErr) {
                        return res.status(500).render("error", {
                            sitePages: sitePages,
                            user: req.user,
                            
                            message: "There was an error creating the item."
                        });
                    } else {
                        database.execute(getNewProductQuery, dbParams, function (rlErr, rlRes, rlFields) {
                            if (rlErr || rlRes == null || rlRes.length == 0) {
                                return res.status(500).render("error", {
                                    sitePages: sitePages,
                                    user: req.user,
                                    
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
            sitePages: sitePages,
            user: req.user,
            
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