# Start with debian jessie
FROM debian:jessie
# Get prerequisites
RUN apt-get update && apt-get install -y \
  libcairo2-dev \
  man-db \
  nodejs \
  nodejs-legacy \
  npm
# Upgrading npm allegedly works around the REPLACE_INVALID_UTF8 issue
RUN npm -g install npm
# Put the app in here
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
# Get npm stuff
COPY package.json /usr/src/app/
RUN npm install
# Get everything else
COPY . /usr/src/app
# Expose the port we listen on
EXPOSE 80
# Run it
CMD [ "npm", "start" ]
