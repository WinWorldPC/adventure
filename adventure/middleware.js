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

module.exports = {
    restrictedRoute: restrictedRoute,
};