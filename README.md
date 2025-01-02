# sudo-humans

hackerspace membership server for sudoroom

## Contributing

Issue reports and pull requests are very welcome. If you're interested in
contributing code, please see [HACKING.md](./HACKING.md). If the documentation
is confusing or hard to follow, please open an issue. We want to make this
project easy to hack on.

## In-progress multi-collective features

Define your collectives in settings.js (you need to define all of the fields you see in settings.js.example).

When you create your first user it will be granted all priveleges for all collectives.

Payments for multi-collective are working, just edit your profile and you can edit your membership for each collective.

And it would be really nice to have:

* Automatic emails sent to members when their payments fail. (#64)
* Payment history page for each user that admins can access.

## usage
See [the usage file](./bin/usage.txt)

## dumping the database

Make sure sudo-humans won't be accessible from anywhere other than the local machine.

Set `export_secret` in `settings.js` to a string containing a secure passphrase.

Set `allow_exports` in `settings.js` to `true`.

Start sudo-humans, e.g:

```
./bin/cmd.js --port 5000
```

Run: 

```
wget --no-cookies --header  "Cookie: secret=<export_secret>" http://127.0.0.1:5000/export/datalevel
```


## license

MIT
