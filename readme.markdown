# sudo-humans

hackerspace membership server for sudoroom

# get it running

> _This application is known to work with version `0.10.21` of `node`. There are issues with the `tcp-bind` and `canvas` modules, but once they are updated you should be able to run with version `0.12` of `node`._

Install [node](https://nodejs.org) and `libcairo2-dev`:

```
$ sudo apt-get install nodejs libcairo2-dev
$ sudo ln -s `which nodejs` /usr/local/bin/node
```

then:

```
$ npm install
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

```

# license

MIT
