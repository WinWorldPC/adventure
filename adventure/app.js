var express = require("express"),
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
    database.userByName(username, function (err, user) {
        if (err) { return cb(err); }
        if (!user) { return cb(null, false); }
        // wtf
        if (user.Password != formatting.sha256(password + (user.Salt || ""))) { return cb(null, false); }
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

function restrictedRoute(flag) {
    return function (req, res, next) {
        if (req.user) {
            if (flag == null || req.user.UserFlags.some(function (x) { return x.FlagName == flag; })) {
                next();
            } else {
                return res.status(403).render("error", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "You aren't allowed to access this route."
                });
            }
        } else {
            return res.redirect("/user/login");
        }
    };
}

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
            return res.status(500).render("error", {
                sitePages: sitePages,
                user: req.user,
                
                message: "There was an error authenticating."
            });
        }
        // if user is not found due to wrong username or password
        if (!user) {
            return res.status(400).render("login", {
                sitePages: sitePages,
                user: req.user,

                message: "Invalid username or password."
            });
        }
        //passport.js has a logIn user method
        req.logIn(user, function (err) {
            if (err) {
                console.log(err);
                return res.status(500).render("error", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "There was an error authenticating."
                });
            }
            
            // Update LastSeenTime
            var id = formatting.hexToBin(user.UserID.toString("hex"));
            database.execute("UPDATE Users SET LastSeenTime = NOW() WHERE UserId = ?", [id], function (lsErr, lsRes, lsFields) {
                // we can wait this one out
            });
            
            // The user has an insecure password and should change it.
            if (user.Salt) {
                return res.redirect("/home");
            } else {
                return res.render("error", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "Your password was stored in an insecure way - you need to <a href='/user/edit'>update it</a>."
                });
            }
        });
    })(req, res);
});

server.get("/user/logout", function (req, res) {
    req.logout();
    return res.redirect("/home");
});

// TODO: Refactor these routes for admins to edit other profiles
// They could use SQL for now, but as we extend, that's infeasible
server.get("/user/edit", restrictedRoute(), function (req, res) {
    return res.render("editProfile", {
        sitePages: sitePages,
        user: req.user,
        
        message: null,
        messageColour: null,
    });
});

server.post("/user/changepw", restrictedRoute(), urlencodedParser, function (req, res) {
    if (req.body && req.body.password && req.body.newPassword && req.body.newPasswordR) {
        if (formatting.sha256(req.body.password) == req.user.Password) {
            if (req.body.newPassword == req.body.newPasswordR) {
                var salt = formatting.createSalt();
                var newPassword = formatting.sha256(req.body.newPassword + salt);
                // HACK: nasty way to demangle UInt8Array
                var id = formatting.hexToBin(req.user.UserID.toString("hex"));
                database.execute("UPDATE Users SET Password = ?, Salt = ? WHERE UserID = ?", [newPassword, salt, id] , function (pwErr, pwRes, pwFields) {
                    if (pwErr) {
                        return res.status(500).render("editProfile", {
                            sitePages: sitePages,
                            user: req.user,
                            
                            message: "There was an error changing your password.",
                            messageColour: "alert-danger",
                        });
                    } else {
                        return res.render("editProfile", {
                            sitePages: sitePages,
                            user: req.user,
                            
                            message: "Your password change was a success!",
                            messageColour: "alert-success",
                        });
                    }
                });
            } else {
                return res.status(400).render("editProfile", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "The new passwords don't match.",
                    messageColour: "alert-danger",
                });
            }
        } else {
            return res.status(403).render("editProfile", {
                sitePages: sitePages,
                user: req.user,
                
                message: "The current password given was incorrect.",
                messageColour: "alert-danger",
            });
        }
    } else {
        return res.status(400).render("editProfile", {
            sitePages: sitePages,
            user: req.user,
            
            message: "The request was malformed.",
            messageColour: "alert-danger",
        });
    }
});

server.post("/user/edit", restrictedRoute(), urlencodedParser, function (req, res) {
    // TODO: Extend as we extend editable profile options (none for now)
    if (req.body && req.body.email) {
        // HACK: nasty way to demangle UInt8Array
        var id = formatting.hexToBin(req.user.UserID.toString("hex"));
        database.execute("UPDATE Users SET Email = ? WHERE UserID = ?", [req.body.email, id] , function (pwErr, pwRes, pwFields) {
            if (pwErr) {
                return res.render("editProfile", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "There was an error changing your profile.",
                    messageColour: "alert-danger",
                });
            } else {
                return res.render("editProfile", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "Your profile change was a success!",
                    messageColour: "alert-success",
                });
            }
        });
    } else {
        return res.status(400).render("editProfile", {
            sitePages: sitePages,
            user: req.user,
            
            message: "The request was malformed.",
            messageColour: "alert-danger",
        });
    }
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
            return res.status(400).render("error", {
                sitePages: sitePages,
                user: req.user,
                
                message: "The category given was invalid."
            });
    }
    
    const productPlatforms = "(SELECT GROUP_CONCAT(DISTINCT Platform) FROM Releases WHERE ProductUUID = Products.ProductUUID)";

    if (category == "OS" && config.specialCaseLibraryOS) {
        database.execute("SELECT `Name`,`Slug`," + productPlatforms + " AS Platform FROM `Products` WHERE `Type` LIKE 'OS' ORDER BY `Name`", [], function (prErr, prRes, prFields) {
            var products = prRes.map(function (x) {
                x.Platform = x.Platform.split(",");
                return x;
            });
            
            var dos = products.filter(function (x) {
                return x.Platform.indexOf("DOS") > -1 || x.Platform.indexOf("CPM") > -1;
            });
            var nix = products.filter(function (x) {
                return x.Platform.indexOf("Unix") > -1 || x.Platform.indexOf("Linux") > -1;
            });
            var mac = products.filter(function (x) {
                return x.Platform.indexOf("MacOS") > -1 || x.Platform.indexOf("Mac OS X") > -1;
            });
            var win = products.filter(function (x) {
                return x.Platform.indexOf("Windows") > -1;
            });
            var os2 = products.filter(function (x) {
                return x.Platform.indexOf("OS2") > -1;
            });
            var other = products.filter(function (x) {
                return x.Platform.indexOf("Other") > -1 || x.Platform.indexOf("DOSShell") > -1;
            });

            return res.render("libraryOS", {
                sitePages: sitePages,
                user: req.user,

                dos: dos,
                nix: nix,
                mac: mac,
                win: win,
                os2: os2,
                other: other,
            });
        });
    } else {
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
}
server.get("/library/:category", libraryRoute);
server.get("/library/:category/:tag", libraryRoute);
server.get("/library", function (req, res) {
    return res.redirect("/library/operating-systems");
});

// TODO: non-CSE search
server.get("/search", function (req, res) {
    return res.render("searchCSE", {
        sitePages: sitePages,
        user: req.user,
        
        q: req.query.q,
        cx: config.cseId
    });
});

// TODO: Experimental view; VIPs only for now now that auth works
function filesRoute(req, res) {
    var page = req.query.page || 1;
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
}
server.get("/files/", restrictedRoute("vip"), filesRoute);

server.get("/product/:product", function (req, res) {
    database.execute("SELECT * FROM `Products` WHERE `Slug` = ?", [req.params.product], function (prErr, prRes, prFields) {
        var product = prRes[0] || null;
        if (product == null) {
            return res.status(404).render("error", {
                sitePages: sitePages,
                user: req.user,
                
                message: "There was no product."
            });
        }
        
        var fallback = function () {
            database.execute("SELECT * FROM `Releases` WHERE `ProductUUID` = ? ORDER BY `ReleaseDate`", [product.ProductUUID], function (rlErr, rlRes, rlFields) {
                var release = rlRes[0] || null;
                if (release) {
                    return res.redirect("/product/" + product.Slug + "/" + release.Slug);
                } else {
                    return res.status(404).render("error", {
                        sitePages: sitePages,
                        user: req.user,
                        
                        message: "The product has no releases."
                    });
                }
            });
        };

        if (product.DefaultRelease) {
            database.execute("SELECT * FROM `Releases` WHERE `ProductUUID` = ? AND `ReleaseUUID` = ?", [product.ProductUUID, product.DefaultRelease], function (reErr, reRes, reFields) {
                var release = reRes[0] || null;
                if (release) {
                    return res.redirect("/product/" + product.Slug + "/" + release.Slug);
                } else {
                    fallback();
                }
            });
        } else {
            fallback();
        }
    });
});

server.get("/product/:product/:release", function (req, res) {
    database.execute("SELECT * FROM `Products` WHERE `Slug` = ?", [req.params.product], function (prErr, prRes, prFields) {
        var product = prRes[0] || null;
        if (product == null) {
            return res.status(404).render("error", {
                sitePages: sitePages,
                user: req.user,
                
                message: "There was no product."
            });
        }

        database.execute("SELECT * FROM `Releases` WHERE `ProductUUID` = ? ORDER BY `ReleaseDate`", [product.ProductUUID], function (rlErr, rlRes, rlFields) {
            if (rlRes == null || rlRes.length == 0) {
                return res.status(404).render("error", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "There was no release."
                });
            }
            var release = rlRes.find(function (x) {
                if (x.Slug == req.params.release)
                    return x;
            });
            if (release == null) {
                return res.status(404).render("error", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "There was no release."
                });
            }
            database.execute("SELECT * FROM `Serials` WHERE `ReleaseUUID` = ?", [release.ReleaseUUID], function (seErr, seRes, seFields) {
                database.execute("SELECT * FROM `Screenshots` WHERE `ReleaseUUID` = ?", [release.ReleaseUUID], function (scErr, scRes, scFields) {
                    database.execute("SELECT * FROM `Downloads` WHERE `ReleaseUUID` = ? ORDER BY `Name`", [release.ReleaseUUID], function (dlErr, dlRes, dlFields) {
                        release.InstallInstructions = marked(release.InstallInstructions || "");
                        release.Notes = marked(release.Notes || "");
                        product.Notes = marked(product.Notes || "");
                        release.ReleaseUUID = formatting.binToHex(release.ReleaseUUID);
                        product.ProductUUID = formatting.binToHex(product.ProductUUID);
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
            if (release == null) {
                return res.status(404).render("error", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "There was no product."
                });
            }
            database.execute("SELECT `Slug`,`ProductUUID` FROM `Products` WHERE `ProductUUID` = ?", [release.ProductUUID], function (prErr, prRes, prFields) {
                var product = prRes[0] || null;
                res.redirect("/product/" + product.Slug + "/" + release.Slug);
            });
        });
    } else {
        return res.status(400).render("error", {
            sitePages: sitePages,
            user: req.user,
            
            message: "The ID given was malformed."
        });
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
        return res.status(400).render("error", {
            sitePages: sitePages,
            user: req.user,
            
            message: "The ID given was malformed."
        });
    }
    var uuidAsBuf = formatting.hexToBin(req.params.download);
    database.execute("SELECT * FROM `Downloads` WHERE `DLUUID` = ?", [uuidAsBuf], function (dlErr, dlRes, dlFields) {
        var download = dlRes[0] || null;
        if (dlErr || download == null) {
            console.log(dlErr || "[ERR] download was null! /download/" + req.params.download + " refererr: " + req.get("Referrer"));
            return res.status(404).render("error", {
                sitePages: sitePages,
                user: req.user,
                
                message: "There was no download."
            });
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

server.get("/download/:download/from/:mirror", function (req, res) {
    if (!(formatting.isHexString(req.params.download) && formatting.isHexString(req.params.mirror))) {
        return res.status(400).render("error", {
            sitePages: sitePages,
            user: req.user,
            
            message: "The ID given is malformed."
        });
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
            return res.status(429).render("error", {
                sitePages: sitePages,
                user: req.user,
                
                message: "You are trying to download too many times. Wait a while, or log in if you haven't to access more."
            });
        }
        database.execute("SELECT * FROM `Downloads` WHERE `DLUUID` = ?", [uuidAsBuf], function (dlErr, dlRes, dlFields) {
            var download = dlRes[0] || null;
            if (dlErr || download == null) {
                console.log(dlErr || "[ERR] download was null! /download/" + req.params.download + "/from/" + req.params.mirror + " refererr: " + req.get("Referrer"));
                return res.status(500).render("error", {
                    sitePages: sitePages,
                    user: req.user,
                    
                    message: "There was no download."
                });
            }
            database.execute("SELECT * FROM `MirrorContents` WHERE `DownloadUUID` = ?", [uuidAsBuf], function (mrErr, mrRes, mrFields) {
                database.execute("SELECT * FROM `DownloadMirrors` WHERE `MirrorUUID` = ?", [mirrorUuidAsBuf], function (miErr, miRes, miFields) {
                    var mirror = miRes[0] || null;
                    if (miErr || mirror == null) {
                        console.log(miErr || "[ERR] mirror was null! /download/" + req.params.download + "/from/" + req.params.mirror + " refererr: " + req.get("Referrer"));
                        return res.status(500).render("error", {
                            sitePages: sitePages,
                            user: req.user,
                            
                            message: "The was no mirror."
                        });
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
        return res.status(400).send("false");
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
            return res.status(403).send("false");
        }
        database.execute("SELECT * FROM `DownloadHits` WHERE `IPAddress` = ? AND `DownloadUUID` = ?", [ip, dl.DLUUID], function (dhErr, dhRes, dhFields) {
            console.log("check-x-sendfile: " + dhRes.length ? "true" : "false" + " for/on " + file + " (" + formatting.binToHex(dl.DLUUID) + ")/" + ip);
            return res.send(dhRes.length ? "true" : "false");
        });
    });
});

// Admin routes
// Use UUID because slug can change
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
        return res.render("saProduct",{
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
            res.status(404).render("error", {
                sitePages: sitePages,
                user: req.user,
                
                message: "There is no release."
            });
        }
        database.execute("SELECT * FROM `Serials` WHERE `ReleaseUUID` = ?", [release.ReleaseUUID], function (seErr, seRes, seFields) {
            release.ReleaseUUID = formatting.binToHex(release.ReleaseUUID);
            return res.render("saRelease", {
                sitePages: sitePages,
                user: req.user,
                
                release: release,
                serials: seRes,
                platformMappingsInverted: constants.platformMappingsInverted
            });
        });
    });
});

server.post("/sa/editReleaseMetadata/:release", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    if (req.body && req.params.release && formatting.isHexString(req.params.release)) {
        var uuid = req.params.release;
        var platform = req.body.platform || "";
        var releaseDate = req.body.releaseDate ? new Date(req.body.releaseDate) : null;
        var endOfLife = req.body.endOfLife ? new Date(req.body.endOfLife) : null;
        var fuzzyDate = req.body.fuzzyDate ? "True" : "False";
        var ramRequirement = req.body.ramRequirement || 0;
        var diskSpaceRequired = req.body.diskSpaceRequired || 0;
        var dbParams = [req.body.name, req.body.vendorName, req.body.slug, req.body.notes, req.body.installInstructions, platform, req.body.type, releaseDate, endOfLife, fuzzyDate, req.body.cpuRequirement, ramRequirement, diskSpaceRequired, formatting.hexToBin(uuid)];
        database.execute("UPDATE Releases SET Name = ?, VendorName = ?, Slug = ?, Notes = ?, InstallInstructions = ?, Platform = ?, Type = ?, ReleaseDate = ?, EndOfLife = ?, FuzzyDate = ?, CPURequirement = ?, RAMRequirement = ?, DiskSpaceRequired = ? WHERE ReleaseUUID = ?", dbParams, function (rlErr, rlRes, rlFields) {
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

// this will soak up anything without routes on root
server.get("/:page", function (req, res) {
    if (sitePages[req.params.page]) {
        if (sitePages[req.params.page].redirectTo) {
            res.redirect(sitePages[req.params.page].redirectTo);
        } else {
            var file = path.join(config.pageDirectory, req.params.page + ".md");
            fs.readFile(file, "utf8", function (err, contents) {
                if (err) {
                    return res.status(500).render("error", {
                        sitePages: sitePages,
                        user: req.user,
                        
                        message: "The page could not be loaded."
                    });
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
        return res.status(404).render("error", {
            sitePages: sitePages,
            user: req.user,
            
            message: "There is no page by this name."
        });
    }
});
server.get("/", function (req, res) {
    return res.redirect("/home");
});

server.listen(3000, config.runBehindProxy ? "127.0.0.1" : "0.0.0.0");