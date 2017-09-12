var express = require("express"),
    bodyParser = require("body-parser"),
    marked = require("marked"),
    mysql = require("mysql2"),
    fs = require("fs"),
    path = require("path"),
    constants = require("./constants.js"),
    formatting = require("./formatting.js");

// HACK: BOM must die
var config = JSON.parse(fs.readFileSync(process.argv[2], "utf8").replace(/^\uFEFF/, ""));

var connection = mysql.createConnection(config.mysql);

var server = express();

var urlencodedParser = bodyParser.urlencoded({ extended: false });

server.use("/static", express.static("static"));
server.set("views", "views");
server.set("view engine", 'ejs');

function libraryRoute(req, res) {
    var page = req.query.page || 1;
    var category = "%"; // % for everything
    switch (req.params.category)
    {
        case "operating-systems":
            category = "OS";
            break;
        case "sys":
            category = "System";
            break
        case "games":
            category = "Game";
            break;
        case "dev":
            category = "DevTool";
            break;
        case "applications":
            category = "Application";
            break;
    }
    var tag = null;
    // TODO: Support richer tag queries than the bare-minimum compat we have
    // with old site (because library pages link to tags in descriptions)
    if (req.params.tag != null) {
        tag = constants.tagMappings[req.params.tag];
    }
    // HACK: I am not proud of this query
    connection.execute("SELECT COUNT(*) FROM `Products` WHERE `Type` LIKE ? && IF(? LIKE '%', ApplicationTags LIKE ?, TRUE)", [category, tag, tag], function (cErr, cRes, cFields) {
        var count = cRes[0]["COUNT(*)"];
        var pages = Math.ceil(count / constants.perPage);
        // TODO: Break up these queries, BADLY
        connection.execute("SELECT `Name`,`Slug`,`ApplicationTags`,`Notes` FROM `Products` WHERE `Type` LIKE ? && IF(? LIKE '%', ApplicationTags LIKE ?, TRUE) ORDER BY `Name` LIMIT ?,?", [category, tag, tag, (page - 1) * constants.perPage, constants.perPage], function (prErr, prRes, prFields) {
            // TODO: Special-case OS for rendering the old custom layout
            res.render("library", {
                products: prRes,
                page: page,
                pages: pages,
                category: req.params.category,
                tag: req.params.tag
            });
        });
    });
}
server.get("/library/:category", libraryRoute);
server.get("/library/:category/:tag", libraryRoute);
server.get("/library", function (req, res) {
    return res.redirect("/library/operating-systems");
});

server.get("/product/:product", function (req, res) {
    connection.execute("SELECT * FROM `Products` WHERE `Slug` = ?", [req.params.product], function (prErr, prRes, prFields) {
        var product = prRes[0] || null;
        if (product == null) {
            return res.sendStatus(404);
        } else if (product.DefaultRelease) {
            connection.execute("SELECT * FROM `Releases` WHERE `ProductUUID` = ? AND `ReleaseUUID` = ?", [product.ProductUUID, product.DefaultRelease], function (reErr, reRes, reFields) {
                var release = reRes[0] || null;
                if (release) {
                    return res.redirect("/product/" + product.Slug + "/" + release.Slug);
                } else {
                    return res.sendStatus(404);
                }
            });
        } else {
            connection.execute("SELECT * FROM `Releases` WHERE `ProductUUID` = ? ORDER BY `ReleaseOrder`", [product.ProductUUID], function (rlErr, rlRes, rlFields) {
                var release = rlRes[0] || null;
                if (release) {
                    return res.redirect("/product/" + product.Slug + "/" + release.Slug);
                } else {
                    return res.sendStatus(404);
                }
            });
        }
    });
});

server.get("/product/:product/:release", function (req, res) {
    connection.execute("SELECT * FROM `Products` WHERE `Slug` = ?", [req.params.product], function (prErr, prRes, prFields) {
        var product = prRes[0] || null;
        if (product == null) return res.sendStatus(404);
        connection.execute("SELECT * FROM `Releases` WHERE `ProductUUID` = ? ORDER BY `ReleaseOrder`", [product.ProductUUID], function (rlErr, rlRes, rlFields) {
            connection.execute("SELECT * FROM `Releases` WHERE `ProductUUID` = ? AND `Slug` = ?", [product.ProductUUID, req.params.release], function (reErr, reRes, reFields) {
                var release = reRes[0] || null;
                if (release == null) return res.sendStatus(404);
                connection.execute("SELECT * FROM `Serials` WHERE `ReleaseUUID` = ?", [release.ReleaseUUID], function (seErr, seRes, seFields) {
                    connection.execute("SELECT * FROM `Downloads` WHERE `ReleaseUUID` = ?", [release.ReleaseUUID], function (dlErr, dlRes, dlFields) {
                        var iiFormated = marked(release.InstallInstructions || "");
                        var relNotesFormated = marked(release.Notes || "");
                        var productNotesFormatted = marked(product.Notes || "");
                        // format beforehand, rather than in rendering or client end
                        release.RAMRequirement = formatting.formatBytes(release.RAMRequirement);
                        release.DiskSpaceRequired = formatting.formatBytes(release.DiskSpaceRequired);
                        var downloads = dlRes.map(function (x) {
                            x.FileSize = formatting.formatBytes(x.FileSize);
                            x.ImageType = constants.fileTypeMappings[x.ImageType];
                            return x;
                        });
                        res.render("release", {
                            product: product,
                            releases: rlRes,
                            release: release,
                            serials: seRes,
                            downloads: downloads,
                            productNotesFormatted: productNotesFormatted,
                            iiFormated: iiFormated,
                            relNotesFormated: relNotesFormated,
                        });
                    });
                });
            });
        });
    });
});

server.get("/download/:download", function (req, res) {
    // TODO: UUID compatiability
    // UUID format is like 60944f2b-4520-11e4-8d58-7054d21a8599/from/630d4e90-3d33-11e6-977e-525400b25447
    var uuidAsBuf = Buffer.from(req.params.download, "hex");
    connection.execute("SELECT * FROM `Downloads` WHERE `DLUUID` = ?", [uuidAsBuf], function (dlErr, dlRes, dlFields) {
        var download = dlRes[0] || null;
        connection.execute("SELECT * FROM `MirrorContents` WHERE `DownloadUUID` = ?", [uuidAsBuf], function (mrErr, mrRes, mrFields) {
            connection.execute("SELECT * FROM `DownloadMirrors` WHERE `IsOnline` = True", null, function (miErr, miRes, miFields) {
                // filter out mirrors that aren't online and have the file
                // HACK: arrays are NOT comparable, so turn them into strings
                var mirrors = miRes.filter(function (x) {
                    return mrRes.map(function (y) {
                        return y.MirrorUUID.toString("hex");
                    }).indexOf(x.MirrorUUID.toString("hex")) > -1;
                });
                res.render("selectMirror", { download: download, mirrors: mirrors });
            });
        });
    });
});

// BREAKING: The DownloadHits schema has changed from the original WinWorld to
// Adventure. The new schema is:
/*
 * DROP TABLE IF EXISTS `DownloadHits`;
 * CREATE TABLE IF NOT EXISTS `DownloadHits` (
 *   `DownloadUUID` binary(16) NOT NULL,
 *   `MirrorUUID` binary(16) NOT NULL,
 *   `SessionUUID` binary(16) DEFAULT NULL,
 *   `UserUUID` binary(16) DEFAULT NULL,
 *   `IPAddress` varchar(46) COLLATE utf8_bin NOT NULL,
 *   `DownloadTime` timestamp NOT NULL DEFAULT current_timestamp(),
 *   KEY `DownloadUUID` (`DownloadUUID`),
 *   KEY `UserUUID` (`UserUUID`),
 *   KEY `MirrorUUID` (`MirrorUUID`),
 *   KEY `DownloadTime` (`DownloadTime`),
 *   KEY `IPAddress` (`IPAddress`)
 * ) ENGINE=Aria DEFAULT CHARSET=utf8 COLLATE=utf8_bin PAGE_CHECKSUM=1;
 */
// IP addresses are stored as strings now, and session UUIDs are nullable (and
// not keyed, because the sessions table has been dropped for now)

//  Garbage collection scriot:
//     DELETE FROM DownloadHits WHERE DATE_SUB(DownloadTime,INTERVAL 1 DAY) > CURDATE()
server.get("/download/:download/from/:mirror", function (req, res) {
    // TODO: UUID compatiability
    // UUID format is like 60944f2b-4520-11e4-8d58-7054d21a8599/from/630d4e90-3d33-11e6-977e-525400b25447
    var uuidAsBuf = Buffer.from(req.params.download, "hex");
    var mirrorUuidAsBuf = Buffer.from(req.params.mirror, "hex");
    // check how many downloads where hit (no user/session just yet)
    connection.execute("SELECT * FROM `DownloadHits` WHERE IPAddress = ? AND DownloadTime > CURDATE()", [req.ip], function (idhErr, idhRes, idhFields) {
        //  25 for now is a reasonable limit
        if (idhRes.length > 25) {
            return res.sendStatus(429);
        }
        connection.execute("SELECT * FROM `Downloads` WHERE `DLUUID` = ?", [uuidAsBuf], function (dlErr, dlRes, dlFields) {
            var download = dlRes[0] || null;
            connection.execute("SELECT * FROM `MirrorContents` WHERE `DownloadUUID` = ?", [uuidAsBuf], function (mrErr, mrRes, mrFields) {
                connection.execute("SELECT * FROM `DownloadMirrors` WHERE `MirrorUUID` = ?", [mirrorUuidAsBuf], function (miErr, miRes, miFields) {
                    var mirror = miRes[0] || null;
                    // TODO: I think escape sequences may need to be replaced too?
                    var downloadPath = "http://" + mirror.Hostname + "/" + download.DownloadPath;//.replace("&", "+");
                    connection.execute("INSERT INTO `DownloadHits` (DownloadUUID, MirrorUUID, IPAddress) VALUES (?, ?, ?)", [uuidAsBuf, mirrorUuidAsBuf, req.ip], function (dhErr, dhRes, dhFields) {
                        return res.redirect(downloadPath);
                    });
                });
            });
        });
    });
});

server.post("/check-x-sendfile", urlencodedParser, function (req, res) {
    var file = req.body.file;
    var uuid = Buffer.from(file, "hex");
    var ip = req.body.ip;
    connection.execute("SELECT DLUUID FROM `Downloads` WHERE `DownloadPath` =", [ip, file], function (dhErr, dhRes, dhFields) {
        var dl = dhRes[0] || null;
        if (dl == null) {
            return res.send("false");
        }
        connection.execute("SELECT * FROM `DownloadHits` WHERE `IPAddress` = ? AND `DownloadUUID` = ?", [ip, dl.DLUUID], function (dhErr, dhRes, dhFields) {
            return res.send(dhRes.length ? "true" : "false");
        });
    });
});

// this will soak up anything without routes on root
server.get("/:page", function (req, res) {
    var file = path.join(config.pageDirectory, req.params.page + ".md");
    fs.readFile(file, "utf8", function (err, contents) {
        if (err) {
            return res.sendStatus(404);
        }
        var page = marked(contents);
        var title = req.params.page;
        return res.render("page", {
            page: page,
            title: title,
        });
    });
});
server.get("/", function (req, res) {
    return res.redirect("/home");
});

server.listen(3000);