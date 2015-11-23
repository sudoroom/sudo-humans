# sudo-humans

hackerspace membership server for sudoroom

WARNING! We are in the process of implementing features to support multiple collectives/organizations on a single instance of sudo-humans but this work is not yet complete. Expect things to be broken. Go back to when this notice disappears to get something that works.

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

For now there is a problem with html-template (actually it is due to its dependency 'readable-stream' not using semantic versioning). To fix this:

```
$ cd node_modules/html-template/
$ rm -rf node_modules

# edit package.json changing the readable-stream dependency line to:
    "readable-stream": "1.0.33"

$ npm install
$ cd ../../
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
