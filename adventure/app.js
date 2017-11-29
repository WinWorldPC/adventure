var express = require("express"),
    morgan = require("morgan"),
    flash = require("flash"),
    cookieParser = require("cookie-parser"),
    sessionParser = require("express-session"),
    database = require("./database.js"),
    fs = require("fs"),
    path = require("path"),
    formatting = require("./formatting.js"),
    middleware = require("./middleware.js");

// HACK: BOM must die
var config = JSON.parse(fs.readFileSync(process.argv[2], "utf8").replace(/^\uFEFF/, ""));
var sitePages = JSON.parse(fs.readFileSync(path.join(config.pageDirectory, "titles.json"), "utf8").replace(/^\uFEFF/, ""));
var headerFragment = fs.readFileSync(config.headerFragment, "utf8").replace(/^\uFEFF/, "");

database.createConnection(config.mysql);

// Init server and middleware
var server = express();
server.locals = {
    config: config,
    sitePages: sitePages,
    headerFragment: headerFragment,
};
server.use(cookieParser());
server.use(sessionParser({ secret: config.sessionSecret || "hello world", resave: false, saveUninitialized: false }));
server.use(flash());
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

// Application routes
server.use(function (req, res, next) {
    res.locals.user = req.user;
    res.locals.loginRedirectTarget = (req.method == "GET" ? req.path : req.get("Referrer")) || "";
    next();
});
server.use(require("./userRoutes.js")(config, database, sitePages));

server.use(require("./libraryRoutes.js")(config, database, sitePages));

server.use(require("./saDownloadRoutes.js")(config, database, sitePages));
server.use(require("./saProductRoutes.js")(config, database, sitePages));
server.use(require("./saReleaseRoutes.js")(config, database, sitePages));
server.use(require("./saMirrorRoutes.js")(config, database, sitePages));
server.use(require("./saContributionRoutes.js")(config, database));
server.use(require("./saUserRoutes.js")(config, database, sitePages));

// handle last because pages soaks up root routes
server.use(require("./pageRoutes.js")(config, database, sitePages));

server.listen(3000, config.runBehindProxy ? "127.0.0.1" : "0.0.0.0");