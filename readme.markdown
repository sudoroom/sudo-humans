# sudo-humans

hackerspace membership server for sudoroom

WARNING! We are in the process of implementing features to support multiple collectives/organizations on a single instance of sudo-humans but this work is not yet complete. Expect things to be broken. Use the main branch until then.

# In-progress multi-collective features

Define your collectives in settings.js (you need to define all of the fields you see in settings.js.example).

When you create your first user it will be granted all priveleges for all collectives.

Payments for multi-collective is working, just edit your profile and you can edit your membership for each collective.

Admins can also access a per-collective admin dashboard. Currently it is not linked anywhere but it is located at:

```
/admin/<collective_name>
```

We still need to implement the following:

* A way for users to join collectives (as unprivileged comrades) on signup and in general
* A way for admins to grant/revoke privileges (membership, admin)
* A way to migrate the old user database to the new multi-collective format

And it would be really nice to have:

* Automatic emails sent to members when their payments fail.
* Payment history page for each user that admins can access.

# get it running

> _This application is known to work with version `0.10.21` of `node`. There is an issue with the `canvas` module, but once it is updated you should be able to run with version `0.12` of `node`._

Install [node](https://nodejs.org) and `libcairo2-dev`:

```
$ sudo apt-get install nodejs libcairo2-dev
$ sudo ln -s `which nodejs` /usr/local/bin/node
```

Make a settings file (and edit to taste):

```
$ cp -a settings.js.example settings.js
```

then:

```
$ npm install
```

Start sudo-humans:

```
$ npm start
```

# usage

```
sudo-humans {OPTIONS}

  Start the sudoroom membership server.

OPTIONS are:

  -p --port     Start the server on a port. Default: 80 (if root) or 8000
  -d --datadir  Directory to put data. 
  -u --uid      Drop to this uid after allocating the port.
  -g --gid      Drop to this gid after allocating the port.
  -h --help     Show this message.
  -D --debug    Enable debug output (warning: will output private data to console)

```

# license

MIT
