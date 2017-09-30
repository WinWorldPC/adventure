var express = require("express"),
    favicon = require("serve-favicon"),
    morgan = require("morgan"),
    bodyParser = require("body-parser"),
    cookieParser = require("cookie-parser"),
    sessionParser = require("express-session"),
    passport = require("passport"),
    localStrategy = require("passport-local").Strategy,
    marked = require("marked"),
    database = require("./database.js"),
    fs = require("fs"),
    path = require("path"),
    crypto = require("crypto"),
    constants = require("./constants.js"),
    formatting = require("./formatting.js");

// HACK: BOM must die
var config = JSON.parse(fs.readFileSync(process.argv[2], "utf8").replace(/^\uFEFF/, ""));
var sitePages = JSON.parse(fs.readFileSync(path.join(config.pageDirectory, "titles.json"), "utf8").replace(/^\uFEFF/, ""));

database.createConnection(config.mysql);

// Init passport
database.execute("SELECT * FROM `UserFlags`", [], function (ufErr, ufRes, ufFields) {
    // first, init userFlags
    database.userFlags = ufRes;
});
passport.use("local", new localStrategy({ usernameField: "username", passwordField: "password" }, function (username, password, cb) {
    database.userByEmail(username, function (err, user) {
        if (err) { return cb(err); }
        if (!user) { return cb(null, false); }
        // wtf
        if (user.Password != crypto.createHash("sha256").update(password).digest("hex")) { return cb(null, false); }
        return cb(null, user);
    });
}));
passport.serializeUser(function (user, cb) {
    // UInt8Arrays don't take to the DB well, so mangle first
    cb(null, user.UserID.toString("hex"));
});
passport.deserializeUser(function (id, cb) {
    database.userById(formatting.hexToBin(id), function (err, user) {
        if (err) { return cb(err); }
        cb(null, user);
    });
});

// Init server and middleware
var server = express();

var urlencodedParser = bodyParser.urlencoded({ extended: false });
server.use(cookieParser());
server.use(sessionParser({ secret: config.sessionSecret || "hello world", resave: false, saveUninitialized: false }));
server.use(passport.initialize());
server.use(passport.session());
server.use(morgan(config.morganLogFormat));
// if it's not there, don't use it - theoretically then, nginx could be handling it
if (config.resDirectory) {
    server.use("/res", express.static(config.resDirectory));
}
server.set("views", config.viewDirectory);
server.set("view engine", 'ejs');
if (config.runBehindProxy) {
    server.set("trust proxy", "127.0.0.1"); // don't hardcode?
}

// Robots.txt and other such stuff
var faviconPath = path.join(config.resDirectory, "img", "favicon.ico");
if (fs.existsSync(faviconPath)) {
    server.use(favicon(faviconPath));
}

server.get("/robots.txt", function (req, res) {
    return res.sendFile(path.join(config.resDirectory, "robots.txt"));
});

// Auth routes
server.get("/user/login", function (req, res) {
    if (req.user) {
        return res.redirect(req.get("Referrer") || "/home");
    } else {
        return res.render("login", {
            sitePages: sitePages,
            user: req.user,

            message: null
        });
    }
});

server.post("/user/login", urlencodedParser, function (req, res) {
    passport.authenticate("local", function (err, user, info) {
        if (err) {
            console.log(err);
            return res.sendStatus(500);
        }
        // if user is not found due to wrong username or password
        if (!user) {
            return res.render("login", {
                sitePages: sitePages,
                user: req.user,

                message: "Invalid username or password."
            });
        }
        //passport.js has a logIn user method
        req.logIn(user, function (err) {
            if (err) {
                console.log(err);
                return res.sendStatus(500);
            }
            
            return res.redirect("/home");
        });
    })(req, res);
});

server.get("/user/logout", function (req, res) {
    req.logout();
    return res.redirect("/home");
});

// Library routes
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
        default:
            return res.sendStatus(400);
    }
    var tag = null;
    var platform = null;
    // TODO: Support richer tag queries than the bare-minimum compat we have
    // with old site (because library pages link to tags in descriptions)
    if (req.params.tag != null) {
        if (req.params.tag.indexOf("tag-") == 0) {
            tag = constants.tagMappings[req.params.tag] || null;
        } else if (req.params.tag.indexOf("platform-") == 0) {
            platform = constants.platformMappings[req.params.tag] || null;
        }
    }
    // HACK: I am EXTREMELY not proud of ANY of these queries
    // they need UDFs and building on demand BADLY
    const productPlatforms = "(SELECT GROUP_CONCAT(DISTINCT Platform) FROM Releases WHERE ProductUUID = Products.ProductUUID)";
    database.execute("SELECT COUNT(*)," + productPlatforms + " AS Platform FROM `Products` WHERE `Type` LIKE ? && IF(? LIKE '%', ApplicationTags LIKE CONCAT(\"%\", ?, \"%\"), TRUE) && IF(? LIKE '%', " + productPlatforms + " LIKE CONCAT(\"%\", ?, \"%\"), TRUE)", [category, tag, tag, platform, platform], function (cErr, cRes, cFields) {
        var count = cRes[0]["COUNT(*)"];
        var pages = Math.ceil(count / config.perPage);
        // TODO: Break up these queries, BADLY
        database.execute("SELECT `Name`,`Slug`,`ApplicationTags`,`Notes`,`Type`," + productPlatforms + " AS Platform FROM `Products` HAVING `Type` LIKE ? && IF(? LIKE '%', ApplicationTags LIKE CONCAT(\"%\", ?, \"%\"), TRUE) && IF(? LIKE '%', Platform LIKE CONCAT(\"%\", ?, \"%\"), TRUE) ORDER BY `Name` LIMIT ?,?", [category, tag, tag, platform, platform, (page - 1) * config.perPage, config.perPage], function (prErr, prRes, prFields) {
            // truncate and markdown
            var productsFormatted = prRes.map(function (x) {
                x.Notes = marked(formatting.truncateToFirstParagraph(x.Notes));
                return x;
            })
            // TODO: Special-case OS for rendering the old custom layout
            res.render("library", {
                sitePages: sitePages,
                user: req.user,

                products: productsFormatted,
                page: page,
                pages: pages,
                pageBounds: config.perPageBounds,
                category: req.params.category,
                tag: req.params.tag,
                tagMappingsInverted: constants.tagMappingsInverted,
                platformMappingsInverted: constants.platformMappingsInverted
            });
        });
    });
}
server.get("/library/:category", libraryRoute);
server.get("/library/:category/:tag", libraryRoute);
server.get("/library", function (req, res) {
    return res.redirect("/library/operating-systems");
});

// TODO: Experimental view; VIPs only for now now that auth works
function filesRoute(req, res) {
    var page = req.query.page || 1;
    
    if (req.user && req.user.UserFlags.some(function (x) { return x.FlagName == "vip"; })) {
        // Downloads without releases associated are essentially orphans that should be GCed
        database.execute("SELECT COUNT(*) FROM `Downloads` WHERE `ReleaseUUID` IS NOT NULL", function (cErr, cRes, cFields) {
            var count = cRes[0]["COUNT(*)"];
            var pages = Math.ceil(count / config.perPage);
            database.execute("SELECT * FROM `Downloads` WHERE `ReleaseUUID` IS NOT NULL ORDER BY `FileName` LIMIT ?,?", [(page - 1) * config.perPage, config.perPage], function (fiErr, fiRes, fiFields) {
                var files = fiRes.map(function (x) {
                    x.FileSize = formatting.formatBytes(x.FileSize);
                    x.ImageType = constants.fileTypeMappings[x.ImageType];
                    x.DLUUID = formatting.binToHex(x.DLUUID);
                    x.ReleaseUUID = formatting.binToHex(x.ReleaseUUID);
                    return x;
                });
                res.render("files", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    page: page,
                    pages: pages,
                    pageBounds: config.perPageBounds,
                    files: files
                });
            });
        });
    } else if (req.user) {
        return res.sendStatus(403);
    } else {
        return res.redirect("/login");
    }
}
server.get("/files/", filesRoute);

server.get("/product/:product", function (req, res) {
    database.execute("SELECT * FROM `Products` WHERE `Slug` = ?", [req.params.product], function (prErr, prRes, prFields) {
        var product = prRes[0] || null;
        if (product == null) {
            return res.sendStatus(404);
        } else if (product.DefaultRelease) {
            database.execute("SELECT * FROM `Releases` WHERE `ProductUUID` = ? AND `ReleaseUUID` = ?", [product.ProductUUID, product.DefaultRelease], function (reErr, reRes, reFields) {
                var release = reRes[0] || null;
                if (release) {
                    return res.redirect("/product/" + product.Slug + "/" + release.Slug);
                } else {
                    return res.sendStatus(404);
                }
            });
        } else {
            database.execute("SELECT * FROM `Releases` WHERE `ProductUUID` = ? ORDER BY `ReleaseDate`", [product.ProductUUID], function (rlErr, rlRes, rlFields) {
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
    database.execute("SELECT * FROM `Products` WHERE `Slug` = ?", [req.params.product], function (prErr, prRes, prFields) {
        var product = prRes[0] || null;
        if (product == null) return res.sendStatus(404);
        database.execute("SELECT * FROM `Releases` WHERE `ProductUUID` = ? ORDER BY `ReleaseDate`", [product.ProductUUID], function (rlErr, rlRes, rlFields) {
            if (rlRes == null || rlRes.length == 0) return res.sendStatus(404);
            var release = rlRes.find(function (x) {
                if (x.Slug == req.params.release)
                    return x;
            });
            if (release == null) return res.sendStatus(404);
            database.execute("SELECT * FROM `Serials` WHERE `ReleaseUUID` = ?", [release.ReleaseUUID], function (seErr, seRes, seFields) {
                database.execute("SELECT * FROM `Screenshots` WHERE `ReleaseUUID` = ?", [release.ReleaseUUID], function (scErr, scRes, scFields) {
                    database.execute("SELECT * FROM `Downloads` WHERE `ReleaseUUID` = ? ORDER BY `Name`", [release.ReleaseUUID], function (dlErr, dlRes, dlFields) {
                        release.InstallInstructions = marked(release.InstallInstructions || "");
                        release.Notes = marked(release.Notes || "");
                        product.Notes = marked(product.Notes || "");
                        // format beforehand, rather than in rendering or client end
                        release.RAMRequirement = formatting.formatBytes(release.RAMRequirement);
                        release.DiskSpaceRequired = formatting.formatBytes(release.DiskSpaceRequired);
                        var downloads = dlRes.map(function (x) {
                            x.FileSize = formatting.formatBytes(x.FileSize);
                            x.ImageType = constants.fileTypeMappings[x.ImageType];
                            x.DLUUID = formatting.binToHex(x.DLUUID);
                            return x;
                        });
                        var screenshots = scRes == null ? null : scRes.map(function (x) {
                            x.ScreenshotFile = config.screenshotBaseUrl + x.ScreenshotFile;
                            return x;
                        });
                        res.render("release", {
                            sitePages: sitePages,
                            user: req.user,

                            product: product,
                            releases: rlRes,
                            release: release,
                            serials: seRes,
                            screenshots: screenshots,
                            downloads: downloads,

                            tagMappingsInverted: constants.tagMappingsInverted,
                            platformMappingsInverted: constants.platformMappingsInverted
                        });
                    });
                });
            });
        });
    });
});

server.get("/release/:id", function (req, res) {
    if (formatting.isHexString(req.params.id)) {
        var uuid = formatting.hexToBin(req.params.id);
        database.execute("SELECT `ReleaseUUID`,`Slug`,`ProductUUID` FROM `Releases` WHERE `ReleaseUUID` = ?", [uuid], function (rlErr, rlRes, rlFields) {
            var release = rlRes[0] || null;
            database.execute("SELECT `Slug`,`ProductUUID` FROM `Products` WHERE `ProductUUID` = ?", [release.ProductUUID], function (prErr, prRes, prFields) {
                var product = prRes[0] || null;
                res.redirect("/product/" + product.Slug + "/" + release.Slug);
            });
        });
    } else {
        return res.sendStatus(400);
    }
});

server.get("/download/test/", function (req, res) {
    database.execute("SELECT * FROM `DownloadMirrors` WHERE `IsOnline` = True", null, function (miErr, miRes, miFields) {
        res.render("test", {
            sitePages: sitePages,
            user: req.user,

            ip: req.ip,
            mirrors: miRes
        });
    });
});

server.get("/download/:download", function (req, res) {
    if (!formatting.isHexString(req.params.download)) {
        return res.sendStatus(400);
    }
    var uuidAsBuf = formatting.hexToBin(req.params.download);
    database.execute("SELECT * FROM `Downloads` WHERE `DLUUID` = ?", [uuidAsBuf], function (dlErr, dlRes, dlFields) {
        var download = dlRes[0] || null;
        if (dlErr || download == null) {
            console.log(dlErr || "[ERR] download was null! /download/" + req.params.download + " refererr: " + req.get("Referrer"));
            return res.sendStatus(500);
        }
        database.execute("SELECT * FROM `MirrorContents` WHERE `DownloadUUID` = ?", [uuidAsBuf], function (mrErr, mrRes, mrFields) {
            database.execute("SELECT * FROM `DownloadMirrors` WHERE `IsOnline` = True", null, function (miErr, miRes, miFields) {
                // filter out mirrors that aren't online and have the file
                // HACK: arrays are NOT comparable, so turn them into strings
                // then munge the buffer into an MU compatible UUID string
                var mirrors = miRes.filter(function (x) {
                    return mrRes.map(function (y) {
                        return y.MirrorUUID.toString("hex");
                    }).indexOf(x.MirrorUUID.toString("hex")) > -1;
                }).map(function (x) {
                    x.MirrorUUID = formatting.binToHex(x.MirrorUUID);
                    return x;
                });;

                if (download.Information) {
                    download.Information - marked(download.Information);
                }
                download.ImageType = constants.fileTypeMappings[download.ImageType];
                download.FileSize = formatting.formatBytes(download.FileSize);
                // turn these into the proper links
                download.DLUUID = formatting.binToHex(download.DLUUID);
                res.render("selectMirror", {
                    sitePages: sitePages,
                    user: req.user,

                    download: download, mirrors: mirrors
                });
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
server.get("/download/:download/from/:mirror", function (req, res) {
    if (!(formatting.isHexString(req.params.download) && formatting.isHexString(req.params.mirror))) {
        return res.sendStatus(400);
    }
    // TODO: UUID compatiability
    // UUID format is like 60944f2b-4520-11e4-8d58-7054d21a8599/from/630d4e90-3d33-11e6-977e-525400b25447
    var uuidAsBuf = formatting.hexToBin(req.params.download);
    var mirrorUuidAsBuf = formatting.hexToBin(req.params.mirror);
    // check how many downloads where hit (no user/session just yet)
    database.execute("SELECT * FROM `DownloadHits` WHERE IPAddress = ? AND DownloadTime > CURDATE()", [req.ip], function (idhErr, idhRes, idhFields) {
        const anonymousMax = config.downloadMax || 25;
        var max = anonymousMax;
        if (req.user) {
            // Authenicated users get double
            max *= 2;
            if (req.user.UserFlags.some(function (x) { return x.FlagName == "vip"; })) {
                // VIPs get a LOT more (is this reasonable?)
                //max = Number.MAX_SAFE_INTEGER; // maybe not
                max *= 4;
            }
        }
        if (idhRes.length > max) {
            return res.sendStatus(429);
        }
        database.execute("SELECT * FROM `Downloads` WHERE `DLUUID` = ?", [uuidAsBuf], function (dlErr, dlRes, dlFields) {
            var download = dlRes[0] || null;
            if (dlErr || download == null) {
                console.log(dlErr || "[ERR] download was null! /download/" + req.params.download + "/from/" + req.params.mirror + " refererr: " + req.get("Referrer"));
                return res.sendStatus(500);
            }
            database.execute("SELECT * FROM `MirrorContents` WHERE `DownloadUUID` = ?", [uuidAsBuf], function (mrErr, mrRes, mrFields) {
                database.execute("SELECT * FROM `DownloadMirrors` WHERE `MirrorUUID` = ?", [mirrorUuidAsBuf], function (miErr, miRes, miFields) {
                    var mirror = miRes[0] || null;
                    if (miErr || mirror == null) {
                        console.log(miErr || "[ERR] mirror was null! /download/" + req.params.download + "/from/" + req.params.mirror + " refererr: " + req.get("Referrer"));
                        return res.sendStatus(500);
                    }
                    // TODO: I think escape sequences may need to be replaced too?
                    var downloadPath = "http://" + mirror.Hostname + "/" + download.DownloadPath;//.replace("&", "+");
                    database.execute("INSERT INTO `DownloadHits` (DownloadUUID, MirrorUUID, IPAddress) VALUES (?, ?, ?)", [uuidAsBuf, mirrorUuidAsBuf, req.ip], function (dhErr, dhRes, dhFields) {
                        return res.redirect(downloadPath);
                    });
                });
            });
        });
    });
});

server.post("/check-x-sendfile", urlencodedParser, function (req, res) {
    if (req.body.ip == null || req.body.file == null) {
        console.log("[ERR] check-x-sendfile failed! ip: " + req.body.ip + " file: " + req.body.file)
        return res.sendStatus(400);
    }
    var file = req.body.file;
    console.log("[INFO] check-x-sendfile: url encoded and decoded are " + file + " and " + decodeURIComponent(file));
    file = decodeURIComponent(file);
    var ip = req.body.ip;
    // mirror thing striped the initial ./ sometimes, concat a "%" and use LIKE to grab it
    // TODO: maybe thats a bit overzealous
    database.execute("SELECT DLUUID FROM `Downloads` WHERE `DownloadPath` LIKE CONCAT(\"%\", ?)", [file], function (dhErr, dhRes, dhFields) {
        var dl = dhRes[0] || null;
        if (dl == null) {
            console.log("[ERR] check-x-sendfile failed, null download! false for/on " + file + "/" + ip);
            return res.send("false");
        }
        database.execute("SELECT * FROM `DownloadHits` WHERE `IPAddress` = ? AND `DownloadUUID` = ?", [ip, dl.DLUUID], function (dhErr, dhRes, dhFields) {
            console.log("check-x-sendfile: " + dhRes.length ? "true" : "false" + " for/on " + file + " (" + formatting.binToHex(dl.DLUUID) + ")/" + ip);
            return res.send(dhRes.length ? "true" : "false");
        });
    });
});

// this will soak up anything without routes on root
server.get("/:page", function (req, res) {
    if (sitePages[req.params.page]) {
        if (sitePages[req.params.page].redirectTo) {
            res.redirect(sitePages[req.params.page].redirectTo);
        } else {
            var file = path.join(config.pageDirectory, req.params.page + ".md");
            fs.readFile(file, "utf8", function (err, contents) {
                if (err) {
                    return res.sendStatus(404);
                }
                var page = marked(contents);
                var title = sitePages[req.params.page].title;
                var supressTitle = sitePages[req.params.page].supressTitle || false;
                return res.render("page", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    page: page,
                    title: title,
                    supressTitle: supressTitle
                });
            });
        }
    } else {
        return res.sendStatus(404);
    }
});
server.get("/", function (req, res) {
    return res.redirect("/home");
});

server.listen(3000, config.runBehindProxy ? "127.0.0.1" : "0.0.0.0");