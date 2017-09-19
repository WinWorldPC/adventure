var mysql = require("mysql2");

var pool = null;

module.exports = {
    createConnection: function (params) {
        pool = mysql.createPool(params);
    },
    
    // generic DB query
    execute: function () {
        var sql_args = [];
        var args = [];
        for (var i = 0; i < arguments.length; i++) {
            args.push(arguments[i]);
        }
        var callback = args[args.length - 1]; //last arg is callback
        pool.getConnection(function (err, connection) {
            if (err) {
                console.log(err);
                return callback(err);
            }
            if (args.length > 2) {
                sql_args = args[1];
            }
            connection.execute(args[0], sql_args, function (err, results, fields) {
                connection.release(); // always put connection back in pool after last query
                if (err) {
                    console.log(err);
                    return callback(err);
                }
                callback(null, results, fields);
            });
        });
    }

    // TODO: Turn raw queries from routes into more usable functions (abstract away SQL)
};