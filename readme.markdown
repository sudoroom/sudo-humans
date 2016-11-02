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

## prerequisites
First, [set up Docker](https://docs.docker.com/engine/installation/). Then,
make sure your user has permission to use Docker.
Typically this will involve being a member of a group named docker.

If you can successfully run `docker info`, things are probably okay.

## build an image in which to run the app

Make a settings file (and edit to taste):

```
$ cp -a settings.js.example settings.js
```

Build a new docker image using the `sudo-humans` source code:

```
$ docker build -t $LOGNAME/sudo-humans .
```

Note that `$LOGNAME` will expand to your username, so the `-t` flag, which
applies a repository name to the newly created image, will apply a repository
name that begins with your username. This is a common and recommended practice,
but of course you can call your image anything you like.

Note also that the `docker build` command ends in a dot, which is being used
to specify the current directory.

Building the container will take a while the first time you do it, since it
pulls in a base Debian image and several package dependencies. On subsequent
runs, it will reuse what has already been set up, so it shouldn't take nearly
as long.

If the build process completes successfully, a message like the following will
be displayed:

```
Successfully built d5a48c5c39d0
```

The last part of this message is the image ID, which will vary.

Once the image has been created, you should be able to see it in the image
list:

```
rcsheets@odin:~/sudo-humans$ docker images
REPOSITORY               TAG                 IMAGE ID            CREATED              VIRTUAL SIZE
rcsheets/sudo-humans     latest              d5a48c5c39d0        About a minute ago   534 MB
```

Now that your image has been created, you can start the application:

```
$ docker run -d -p 8080:80 $LOGNAME/sudo-humans
```

The immediate output of the `docker run` command will be a long hexadecimal
string. This is the container ID.

In this example, your app listens on real port 8080. Adjust the port number
to suit your preference. Within the container, the app listens on port 80.
To run the app in the foreground, omit the -d flag.

If all goes according to plan, you'll be able to see that the application
is running inside of its container:

```
rcsheets@odin:~/sudo-humans$ docker ps
CONTAINER ID        IMAGE                  COMMAND             CREATED             STATUS              PORTS                  NAMES
bcbccd48a5f4        rcsheets/sudo-humans   "npm start"         3 minutes ago       Up 3 minutes        0.0.0.0:8080->80/tcp   sick_colden
```

Note that your container can be referred to by its ID or name. The name is
usually easier to type. The ID is more suited for automation purposes.

Stop the application:

```
$ docker stop sick_colden
```

Your container name will vary. You can also specify the container by its ID.


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
