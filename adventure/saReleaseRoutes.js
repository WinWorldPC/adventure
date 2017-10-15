var express = require("express"),
    bodyParser = require("body-parser"),
    multer = require("multer"),
    fs = require("fs"),
    path = require("path"),
    constants = require("./constants.js"),
    middleware = require("./middleware.js"),
    formatting = require("./formatting.js");

var config, database, sitePages;

var restrictedRoute = middleware.restrictedRoute;
var multerStorage = multer.memoryStorage();
var uploadParser = multer({
    storage: multerStorage,
});
var urlencodedParser = bodyParser.urlencoded({ extended: false })
var server = express.Router();

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
                    x.ScreenshotUUID = formatting.binToHex(x.ScreenshotUUID);
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

server.post("/sa/addScreenshot/:release", restrictedRoute("sa"), uploadParser.single("screenshotFile"), function (req, res) {
    if (req.file && req.body && req.body.screenshotTitle) {
        var uuid = req.params.release;
        var uuidAsBuf = formatting.hexToBin(uuid);

        if (!req.file.mimetype.startsWith("image/")) {
            return res.status(400).render("error", {
                sitePages: sitePages,
                user: req.user,

                message: "The file wasn't an image."
            });
        }
        var ext = path.extname(req.file.originalname);

        // generate a filename by making a random filename and appending ext
        var fileName = formatting.createSalt() + ext;
        // TODO: Make this configuratable
        var fullPath = path.join(config.resDirectory, "img", "screenshots", fileName);
        var dbParams = [uuidAsBuf, fileName, req.body.screenshotTitle];
        database.execute("INSERT INTO `Screenshots` (ReleaseUUID, ScreenshotFile, ScreenshotTitle) VALUES (?, ?, ?)", dbParams, function (seErr, seRes, seFields) {
            if (seErr) {
                return res.status(500).render("error", {
                    sitePages: sitePages,
                    user: req.user,

                    message: "The screenshot could not be added to the database."
                });
            } else {
                fs.writeFile(fullPath, req.file.buffer, function (err) {
                    if (err) {
                        return res.status(500).render("error", {
                            sitePages: sitePages,
                            user: req.user,

                            message: "The screenshot could not be written to disk."
                        });
                    } else {
                        return res.redirect("/sa/release/" + uuid);
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

server.get("/sa/deleteScreenshot/:release/:screenshot", restrictedRoute("sa"), function (req, res) {
    if (req.params.release && req.params.screenshot) {
        var uuid = req.params.screenshot;
        var uuidAsBuf = formatting.hexToBin(uuid);
        // TODO: delete file (maybe use query string to confirm?)
        database.execute("DELETE FROM `Screenshots` WHERE `ScreenshotUUID` = ?", [uuidAsBuf], function (scErr, scRes, scFields) {
            if (scErr) {
                return res.status(500).render("error", {
                    sitePages: sitePages,
                    user: req.user,

                    message: "The screenshot could not be removed from the database."
                });
            } else {
                return res.redirect("/sa/release/" + req.params.release);
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

server.post("/sa/editScreenshotTitle/:release/:screenshot", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    if (req.params.release && req.params.screenshot && req.body && req.body.title) {
        var uuid = req.params.screenshot;
        var uuidAsBuf = formatting.hexToBin(uuid);
        var newTitle = req.body.title;
        database.execute("UPDATE `Screenshots` SET `ScreenshotTitle` = ? WHERE `ScreenshotUUID` = ?", [newTitle, uuidAsBuf], function (scErr, scRes, scFields) {
            if (scErr) {
                return res.status(500).render("error", {
                    sitePages: sitePages,
                    user: req.user,

                    message: "The screenshot title could not be changed."
                });
            } else {
                return res.redirect("/screenshot/" + req.params.release + "/" + uuid);
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

module.exports = function (c, d, p) {
    config = c
    database = d;
    sitePages = p;

    return server;
}