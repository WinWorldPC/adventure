# Adventure

Adventure is a node.js powered replacement for the previous library management
system that ran WinWorld before. It's a rigid and simple CMS for managing
websites that provide a library of software, and allow downloading the software
through other servers called mirrors. Features include:

* CRUD operations to manage it

* Rate limiting for downloads, managed by user permissions

* Integration with Vanilla forums, with SSO and commenting

The roadmap is available in the issues. Pull requests are encouraged!

The GitHub wiki also contains documentation on configuration options and
database structure.

## Installation

While work is being done to allow Adventure to power non-WinWorld sites, this
isn't of the highest priority, and is mostly for developers to hack on.

* Ensure you have the dependencies - this is node.js and MariaDB.

* Pull the repo somewhere.

* `npm install`

* Copy `config.example.json` to somewhere and edit it to match your
  configuration and desires. If you're going to change the definitions for the
  library, you need to edit `deploy/install.sql` to match as well.

* Run `deploy/install.sql` to create the tables and an admin user; this will be
  "admin" with password "changeme".

* Start adventure; the only and required command-line parameter is the path to
  the configuration file. Alternatively, set this up in your init daemon; a
  systemd unit is provided in `deploy/adventure.example.service`.

* It is required that you also set up a timer or cron job to run `gc.js` to
  handle cleanup operations on.

* It is also recommended that you put Adventure behind a reverse proxy, such as
  nginx. Adventure listens on port 3000 by default; and facilities to handle
  things such as static resources in the application are primitive and only
  recommended for development.
