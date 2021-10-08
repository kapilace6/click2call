$(document).ready(function () {
  app.initialized().then(function (_client) {
    var client = _client;
    client.events.on("app.activated", function () {
      Promise.all([client.data.get("loggedInUser"), client.iparams.get()]).then(
        function (results) {
          let iparam = results[1];
          let loggedInUser = results[0];
          if (loggedInUser.loggedInUser.role_ids.includes(parseInt(iparam.agentroleid))) {
            client.interface.trigger("hide", { id: "priority" });
            client.interface.trigger("hide", { id: "group" });
          }
        }
      );
    });
  });
});
