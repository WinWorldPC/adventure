var express = require("express"),
    morgan = require("morgan"),
    bodyParser = require("body-parser"),
    cookieParser = require("cookie-parser"),
    sessionParser = require("express-session"),
    passport = require("passport"),
    localStrategy = require("passport-local").Strategy,
    svgCaptcha = require("svg-captcha"),
    marked = require("marked"),
    database = require("./database.js"),
    fs = require("fs"),
    path = require("path"),
    constants = require("./constants.js"),
    formatting = require("./formatting.js"),
    middleware = require("./middleware.js");

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

var restrictedRoute = middleware.restrictedRoute;

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
        if (formatting.sha256(req.body.password + (req.user.Salt || "")) == req.user.Password) {
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

function signupPage(req, res, status, message) {
    var captcha = svgCaptcha.create({ size: 6, noise: 2 });
    req.session.captcha = captcha;

    return res.status(status || 200).render("signup", {
        sitePages: sitePages,
        user: req.user,

        message: message,
        captcha: captcha.data,
    });
}

server.get("/user/signup", function (req, res) {
    return signupPage(req, res, null, null);
});

server.post("/user/signup", urlencodedParser, function (req, res) {
    if (req.body && req.body.username && req.body.password && req.body.captcha && req.body.email) {
        if (req.body.captcha == req.session.captcha.text) {
            // check for username existence
            database.execute("SELECT * FROM `Users` WHERE `ShortName` = ?", [req.body.username], function (slErr, slRes, slFields) {
                if (slErr) {
                    return signupPage(req, res, 500, "There was an error checking the database.");
                } else if (slRes.length > 0) {
                    return signupPage(req, res, 400, "There is already a user with that name.");
                } else {
                    var salt = formatting.createSalt();
                    var password = formatting.sha256(req.body.password + salt);
                    database.execute("INSERT INTO `Users` (`ShortName`, `Email`, `Password`, `Salt`, `RegistrationIP`) VALUES (?, ?, ?, ?, ?)", [req.body.username, req.body.email, password, salt, req.ip], function (inErr, inRes, inFields) {
                        if (inErr) {
                            return signupPage(req, res, 500, "There was an error creating your account.");
                        } else {
                            res.redirect("/user/login");
                        }
                    });
                }
            });
        } else {
            return signupPage(req, res, 400, "The captcha failed verification.");
        }
    } else {
        return signupPage(req, res, 400, "The request was malformed.");
    }
});

// Application routes

server.use(require("./libraryRoutes.js")(config, database, sitePages));

server.use(require("./saRoutes.js")(config, database, sitePages));

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