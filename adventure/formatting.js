var bcrypt = require('bcryptjs');
var crypto = require("crypto");

module.exports = {
    roundToPrecision: function(number, precision) {
        var factor = Math.pow(10, precision);
        var tempNumber = number * factor;
        var roundedTempNumber = Math.round(tempNumber);
        return roundedTempNumber / factor;
    },
    
    formatBytes: function(size) {
        if (size) {
            var base = Math.log(size) / Math.log(1000);
            var suffixes = ["", "KB", "MB", "GB", "TB"];
            var ret = this.roundToPrecision(Math.pow(1000, base - Math.floor(base)), 2) + suffixes[Math.floor(base)];
            return ret || "0";
        } else return "0";
    },

    truncateToFirstParagraph: function (string) {
        // Handle Unix and Windows newlines
        return string.replace(/(.*)\r?\n\r?\n.*/g, "$1");
    },

    isHexString: function (s) {
        if (s && typeof (s) == "string") {
            return /^[0-9A-Fa-f]{8}-?[0-9A-Fa-f]{4}-?[0-9A-Fa-f]{4}-?[0-9A-Fa-f]{4}-?[0-9A-Fa-f]{12}$/.test(s);
        } else return false;
    },

    hexToBin: function (hex) {
        if (hex) {
            return Buffer.from(hex.replace(/-/g, ""), "hex");
        } else {
            return null;
        }
    },

    binToHex: function (bin) {
        if (bin) {
            var s = bin.toString("hex");
            return s.substr(0, 8) + "-" + s.substr(8, 4) + "-" + s.substr(12, 4) + "-" + s.substr(16, 4) + "-" + s.substr(-12);
        } else {
            return null;
        }
    },

    sha256: function (toHash) {
        return crypto.createHash("sha256").update(toHash).digest("hex");
    },

    hmacsha1: function (toHash, salt) {
        return crypto.createHmac("sha1", salt).update(toHash).digest("hex");
    },

    createSalt: function () {
        return crypto.randomBytes(32).toString("hex");
    },

    generateHashPassword: function(password, cb) {
        return bcrypt.hash(password, 12, cb);
    },

    checkPassword: function(specified, salt, storedPassword, cb) {
        if (storedPassword.startsWith("$2a$")) {
            // hashed with bcrypt
            return bcrypt.compare(specified, storedPassword, function(err, success) {
                cb(err, success, true)
            })
        } else {
            // hashed with salted SHA-256 and should be upgraded
            var saltedSpecified = this.sha256(specified + (salt || ""));
            // because we can't use timingSafeEqual on strings
            var storedAsBuf = Buffer.from(storedPassword, "hex");
            var saltedAsBuf = Buffer.from(saltedSpecified, "hex");
            if (storedAsBuf.length != saltedAsBuf.length) {
                // what the hell
                setImmediate(cb, null, false, false);
            } else {
                setImmediate(cb, null, crypto.timingSafeEqual(storedAsBuf, saltedAsBuf, false));
            }
        }
    },

    invertObject: function (o) {
        if (o == null) {
            debugger;
        }

        return Object.keys(o).reduce(function (obj, key) {
            obj[o[key]] = key;
            return obj;
        }, {});
    },
    
    b64encode: function (str) {
        return Buffer.from(str, "utf8").toString("base64");
    },

    groupBy: function (xs, key) {
        return xs.reduce(function (rv, x) {
            let v = key instanceof Function ? key(x) : x[key];
            let el = rv.find((r) => r && r.key === v);
            if (el) {
                el.values.push(x);
            } else {
                rv.push({ key: v, values: [x] });
            } return rv;
        }, []);
    },

    // Converts an array or string (as a web form's select can be either
    // depending on item count) into a string representing a list in the way
    // MySQL prefers it.
    dbStringifySelect: function (toStringify) {
        if (toStringify && typeof toStringify === "string") {
            return toStringify;
        } else if (toStringify && Array.isArray(toStringify)) {
            return toStringify.join(",");
        } else {
            return "";
        }
    },
};
