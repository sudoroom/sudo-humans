
Migrations are run using:

```
./bin/cmd --migrate migration/migration_name.js
```

Migrations _must_ always be safe to run twice. They must not alter the database on subsequent runs after the first!

Migrations must export a single function. This function will be called once with the following arguments:

```
migration(users, ixf, counts, blob, argv, settings, callback)
```