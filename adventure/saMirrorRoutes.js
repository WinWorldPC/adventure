var express = require("express"),
    fs = require("fs"),
    path = require("path"),
    middleware = require("./middleware.js"),
    formatting = require("./formatting.js");

var config, database, sitePages;

var restrictedRoute = middleware.restrictedRoute;
var urlencodedParser = middleware.bodyParser;
var server = express.Router();

server.get("/sa/mirrors", restrictedRoute("sa"), function (req, res) {
    database.execute("SELECT * FROM DownloadMirrors", [], function (mrErr, mrRes, mrFields) {
        return res.render("saMirrors", {
            mirrors: mrRes.map(function (x) {
                x.MirrorUUID = formatting.binToHex(x.MirrorUUID);
                return x;
            })
        });
    });
});

server.get("/sa/mirror/:mirror", restrictedRoute("sa"), function (req, res) {
    database.execute("SELECT * FROM `DownloadMirrors` WHERE `MirrorUUID` = ?", [formatting.hexToBin(req.params.mirror)], function (mrErr, mrRes, mrFields) {
        var mirror = mrRes[0] || null;
        if (mrErr || mirror == null) {
            res.status(404).render("error", {
                message: "There is no mirror."
            });
        }
        mirror.MirrorUUID = formatting.binToHex(mirror.MirrorUUID);
        return res.render("saMirror", {
            mirror: mirror,
        });
    });
});

server.post("/sa/editMirrorMetadata/:mirror", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    if (req.body && req.params.mirror && formatting.isHexString(req.params.mirror)) {
        var uuid = req.params.mirror;
        var dbParams = [req.body.name, req.body.hostname, req.body.online ? "True" : "False", req.body.location, req.body.unixUser, req.body.homeDirectory, req.body.downloadDirectory, req.body.country, formatting.hexToBin(uuid)];
        database.execute("UPDATE DownloadMirrors SET MirrorName = ?, Hostname = ?, IsOnline = ?, Location = ?, UnixUser = ?, HomeDirectory = ?, DownloadDirectory = ?, Country = ? WHERE MirrorUUID = ?", dbParams, function (prErr, prRes, prFields) {
            if (prErr) {
                return res.status(500).render("error", {
                    message: "The mirror could not be edited."
                });
            } else {
                return res.redirect("/sa/mirror/" + req.params.mirror);
            }
        });
    } else {
        return res.status(404).render("error", {
            message: "The request was malformed."
        });
    }
});

server.get("/sa/deleteMirror/:mirror", restrictedRoute("sa"), function (req, res) {
    if (req.params.mirror && formatting.isHexString(req.params.mirror) && req.query && req.query.yesPlease) {
        var uuidAsBuf = formatting.hexToBin(req.params.mirror);

        database.execute("DELETE FROM MirrorContents WHERE MirrorUUID = ?", [uuidAsBuf], function (mcErr, mcRes, mcFields) {
            if (mcErr) {
                return res.status(500).render("error", {
                    message: "There was an error removing mirror presence information."
                });
            }
            database.execute("DELETE FROM DownloadMirrors WHERE MirrorUUID = ?", [uuidAsBuf], function (mrErr, mrRes, mrFields) {
                if (mrErr) {
                    return res.status(500).render("error", {
                        message: "There was an error removing the mirror."
                    });
                } else {
                    return res.redirect("/sa/mirrors");
                }
            });
        });
    } else {
        return res.status(400).render("error", {
            message: "The request was malformed, or you weren't certain."
        });
    }
});

server.get("/sa/createMirror", restrictedRoute("sa"), function (req, res) {
    return res.render("saCreateMirror", {
    });
});

server.post("/sa/createMirror", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    const getNewMirrorQuery = "SELECT * FROM `DownloadMirrors` WHERE `MirrorName` = ? && `Hostname` = ?";

    if (req.body && req.body.hostname && req.body.name) {
        // check for dupe
        var hostname = req.body.hostname;
        var name = req.body.name;
        var dbParams = [name, hostname];
        database.execute(getNewMirrorQuery, dbParams, function (dbErr, dbRes, dbFields) {
            if (dbErr || dbRes == null) {
                return res.status(500).render("error", {
                    message: "There was an error checking the database."
                });
            } else if (dbRes.length > 0) {
                return res.status(409).render("error", {
                    message: "There is already a mirror with that name or hostname."
                });
            } else {
                database.execute("INSERT INTO DownloadMirrors (MirrorName, Hostname) VALUES (?, ?)", dbParams, function (inErr, inRes, inFields) {
                    if (inErr) {
                        return res.status(500).render("error", {
                            message: "There was an error creating the item."
                        });
                    } else {
                        database.execute(getNewMirrorQuery, dbParams, function (mrErr, mrRes, mrFields) {
                            if (mrErr || mrRes == null || mrRes.length == 0) {
                                return res.status(500).render("error", {
                                    message: "There was an error validating the item."
                                });
                            } else {
                                return res.redirect("/sa/mirror/" + mrRes[0].Slug);
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