const axios = require("axios");
const base64 = require("base-64");
const cheerio = require("cheerio");

exports = {
  events: [
    { event: "onTicketUpdate", callback: "onTicketUpdateHandler" },
    { event: "onTicketCreate", callback: "onTicketCreateHandler" }
  ],

  onTicketCreateHandler: function(args) {

    console.log("Logging onTicketCreate data", JSON.stringify(args));
    getTicket(args.data.ticket.id, args.iparams).then(function(response) {
      var ticketData = response.data;
      var patientData = args.data.requester.mobile || args.data.requester.phone;
      if (patientData) {
        console.log("Not Creating Link");
        // create a link
        /*const $ = cheerio.load(
          `<br/><a id="calllink" href="${args.iparams.url}&requester=${patientData}&state=${ticketData.custom_fields.cf_state}">${args.iparams.hyperlinktext}</a>`
        );
        var html = $.html();
        console.log("Log: patientData: " +  patientData + ", html: " + html);*/
        // Append the html to the existing description
        putTicket(
          args.data.ticket.id,
          {
            description: ticketData.description //+ html
          },
          args.iparams
        )
          .then(function(response) {
            console.log("Log: response", response.data);
          })
          .catch(function(err) {
            console.error("Log: err", err);
          });
      } else {
        console.log("Patient number is not there");
      }
    });
  },

  // args is a JSON block containing the payload information.
  // args['iparam'] will contain the installation parameter values.
  onTicketUpdateHandler: function(args) {
    console.log("Logging onTicketUpdate data: ", JSON.stringify(args.data));
    console.log("Responder ID: " + args.data.ticket.responder_id + ", Ticket ID: " + args.data.ticket.id);
    if (args.data.ticket.responder_id !== null) {
      // Proceed with the building of the url
      // get agent's mobile
      Promise.all([
        getAgent(args.data.ticket.responder_id, args.iparams),
        getTicket(args.data.ticket.id, args.iparams)
      ]).then(function(results) {
        var agent = results[0].data;
        var ticket = results[1].data;

        var agentmobile = agent.contact.mobile || agent.contact.phone;

        var $ = cheerio.load(ticket.description);
        var patientData = args.data.requester.mobile || args.data.requester.phone;
        console.log("Log: agentmobile: " + agentmobile + ", patientData: " + patientData + ", CL: " + (!$('#calllink').length));

        var abroadroles = args.iparams.abroadroles.split(',').map(Number);
        var ab_intersection = abroadroles.filter(function(n) {
          return agent.role_ids.indexOf(n) !== -1;
        });

        //Click to Call a Patient
        if(!$('#calllink').length) {
          console.log("Call link does not exist, creating...");
          
          if(ab_intersection.length) {
            $('body').append(
              `<br/><a id="calllink" href="${args.iparams.url}&requester=${patientData}&state=abroad&attendee=${agentmobile}&role=${ab_intersection[0]}">${args.iparams.hyperlinktext}</a>`
            );
          }
          else {
            $('body').append(
              `<br/><a id="calllink" href="${args.iparams.url}&requester=${patientData}&state=${ticket.custom_fields.cf_state}&attendee=${agentmobile}">${args.iparams.hyperlinktext}</a>`
            );
          }
        }
        else {
          console.log("Call Link already exists, changing message to " + args.iparams.url);

          if(ab_intersection.length) {
            $("#calllink").attr(
              "href",
              `${args.iparams.url}&requester=${patientData}&state=abroad&attendee=${agentmobile}&role=${ab_intersection[0]}`
            );
          }
          else {
            $("#calllink").attr(
              "href",
              `${args.iparams.url}&requester=${patientData}&state=${ticket.custom_fields.cf_state}&attendee=${agentmobile}`
            );
          }
          
          $("#calllink").html(`${args.iparams.hyperlinktext}`);
        }

        var allowedroles = args.iparams.allowedroles.split(',').map(Number);
        var intersection = allowedroles.filter(function(n) {
          return agent.role_ids.indexOf(n) !== -1;
        });

        //Prescription Link
        console.log("Prescription / " + $('#prescription').length + "with call link : " + $.html() + ", int -> " + intersection.length + ", Allowed Roles : " + allowedroles + ", Intersection: " + agent.role_ids);

        if(intersection.length) {
          if($('#prescription').length){
            $("#prescription").attr(
              "href",
              `${args.iparams.prescriptionredirecturl}?requester=${patientData}&attendee=${agentmobile}&state=${ticket.custom_fields.cf_state}&ticket_id=${args.data.ticket.id}`
            );
            $("#prescription").html(`${args.iparams.prescriptionlabel}`);
          }
          else {
            $('body').append(
              `<br/><a id="prescription" href="${args.iparams.prescriptionredirecturl}?requester=${patientData}&attendee=${agentmobile}&state=${ticket.custom_fields.cf_state}&ticket_id=${args.data.ticket.id}">${args.iparams.prescriptionlabel}</a>`
            );
          }
          console.log("Log: html", $.html());
        }
        else if($('#prescription').length){
          $('#prescription').remove();
        }

        console.log('Final ticket: ' + $.html());
        putTicket(
          args.data.ticket.id,
          {
            description: $.html()
          },
          args.iparams
        )
          .then(function(response) {
            console.log("Log: response", response.data);
          })
          .catch(function(err) {
            console.error("Log: err", err);
          });
      });
    } else {
      Promise.all([
        getTicket(args.data.ticket.id, args.iparams)
      ]).then(function(results) {
        var ticket = results[0].data;
        var $ = cheerio.load(ticket.description);

        console.log("Removing Call Link & Removing Prescription");
        if($('#calllink').length) {
          $('#calllink').remove();
        }
        if($('#prescription').length){
          $('#prescription').remove();
        }

        console.log('Ticket after removal: ' + $.html());
        putTicket(
          args.data.ticket.id,
          {
            description: $.html()
          },
          args.iparams
        ).then(function(response) {
            console.log("Log: response", response.data);
          })
          .catch(function(err) {
            console.error("Log: err", err);
          });
      });
    }
  }
};

function getAgent(id, iparam) {
  setHeaders(iparam);
  return axios.get(`https://${iparam.fdurl}.freshdesk.com/api/v2/agents/${id}`);
}

function getTicket(ticketId, iparam) {
  setHeaders(iparam);
  return axios.get(
    `https://${iparam.fdurl}.freshdesk.com/api/v2/tickets/${ticketId}`
  );
}

function putTicket(ticketId, payload, iparam) {
  setHeaders(iparam);
  return axios.put(
    `https://${iparam.fdurl}.freshdesk.com/api/v2/tickets/${ticketId}`,
    payload
  );
}

function setHeaders(iparam) {
  axios.defaults.headers.common["Authorization"] = base64.encode(
    iparam.fdapikey + ":*"
  );
}
