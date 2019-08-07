FROM node:12

USER root

RUN npm i npm@6.10.1 -g

# install dependencies first, in a different location for easier app bind mounting for local development
# due to default /opt permissions we have to create the dir with root and change perms
RUN mkdir /opt/node_app && chown node:node /opt/node_app
WORKDIR /opt/node_app

COPY package.json package-lock.json* ./
RUN npm install && npm cache clean --force
ENV PATH /opt/node_app/node_modules/.bin:$PATH

# check every 30s to ensure this service returns HTTP 200
# HEALTHCHECK --interval=30s CMD node healthcheck.js

# copy in our source code last, as it changes the most
WORKDIR /opt/node_app/app
COPY . .

# COPY docker-entrypoint.sh /usr/local/bin/
# https://github.com/BretFisher/node-docker-good-defaults
# ENTRYPOINT ["docker-entrypoint.sh"]

ENTRYPOINT ["node", "exporter.js"]