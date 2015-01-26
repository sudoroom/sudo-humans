# sudo-humans

hackerspace membership server for sudoroom

# get it running

Install [node](https://nodejs.org), then:

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
