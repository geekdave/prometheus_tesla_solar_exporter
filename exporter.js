var tjs = require("geekdave-teslajs-fork");

var username = process.env.TESLA_ACCOUNT_USERNAME;
var password = process.env.TESLA_ACCOUNT_PASSWORD;

if (!username || !password) {
  console.log(
    "Please set the TESLA_ACCOUNT_USERNAME and TESLA_ACCOUNT_PASSWORD environment variables.  Exiting..."
  );
  process.exit(1);
}

var token = "";

const prometheus = require("prom-client");

const express = require("express");

const metricsServer = express();
const up = new prometheus.Gauge({ name: "up", help: "UP Status" });

const metrics = {
  solarPower: new prometheus.Gauge({
    name: "tesla_solar_power",
    help: "solarPower"
  }),
  loadPower: new prometheus.Gauge({
    name: "tesla_load_power",
    help: "loadPower"
  }),
  gridPower: new prometheus.Gauge({
    name: "tesla_grid_power",
    help: "solarPower"
  }),
  tokenResets: new prometheus.Counter({
    name: "tesla_token_resets",
    help: "tokenResets"
  })
};

// const solarPower =

// {"solar_power":663,"load_power":353,"grid_status":"Active","grid_services_active":false,"grid_power":-310,"grid_services_power":0,"timestamp":"2019-08-02T16:27:04-06:00"}

function startServer() {
  console.log("Hello!  I just started my server.");

  metricsServer.get("/metrics", async (req, res) => {
    res.contentType(prometheus.register.contentType);

    try {
      var solarStatus = await getStatus();
      up.set(1);
      res.send(prometheus.register.metrics());
    } catch (error) {
      // error connecting
      up.set(0);
      console.log("Got error: " + error);
      res.header("X-Error", error || error);
      res.send(prometheus.register.getSingleMetricAsString(up.name));
    }
  });

  console.log("Server listening to 9208, metrics exposed on /metrics endpoint");

  // Port to listen on
  // TODO: Allow configuring via parameter
  metricsServer.listen(9208);
}

const login = async (username, password) => {
  return new Promise(function(resolve, reject) {
    tjs.login(username, password, function(err, result) {
      if (result.error) {
        console.log(JSON.stringify(result.error));
        reject(error);
      } else {
        var token = JSON.stringify(result.authToken);
        token = token.replace(/\"/g, "");
        if (token) console.log("Login Succesful! : " + token);
        metrics.tokenResets.inc();
        resolve(token);
      }
    });
  });
};

const getSolarProductId = async (token) => {
  return new Promise(function(resolve, reject) {
    tjs.products({
      authToken: token
    }, function(err, response) {
      if (response.error) {
        console.log(JSON.stringify(response.error));
        reject(error);
      } else {

        resolve(response);
      }
    });
  });
};

const sleep = milliseconds => {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
};

const getStatus = async () => {
  return new Promise(async function(resolve, reject) {
    while (true) {
      if (!token) {
        try {
          console.log(
            "Auth token undefined: Sleeping 2 sec, then obtaining new token from Tesla..."
          );
          await sleep(2000);
          console.log("Logging in...");
          token = await login(username, password);
        } catch (e) {
          console.log(">>> Login failed!!!");
          reject(e);
          break;
        }
      }

      var response = await getSolarProductId(token);
      const siteId = response[0].energy_site_id;
      console.log("got siteId: " + siteId);

      try {
        var status = await getSolarStatus(token, siteId);
        resolve(status);
        break;
      } catch (e) {
        console.log("Got error trying to call loginAndGetStatus");
        if (e === "Unauthorized") {
          console.log(
            "Got Unauthorized error - invalidating token and trying again"
          );
          token = "";
        }
      }
    }
  });
};

const getSolarStatus = async (token, siteId) => {
  return new Promise(function(resolve, reject) {
    tjs.solarStatusAsync(
      {
        authToken: token,
        siteId: siteId
      },
      function(error, response, body) {
        if (error) {
          console.log("Got error trying to call solarStatusAsync");
          reject(error);
        } else {
          console.log("got response!");
          var formatted = JSON.stringify(response);
          console.log(formatted);

          metrics.solarPower.set(response.solar_power);
          metrics.loadPower.set(response.load_power);
          metrics.gridPower.set(response.grid_power);

          resolve(response);
        }
      }
    );
  });
};

startServer();
