const express = require('express');
const program = require('commander');
const WebSocket = require('ws');
const path = require("path");

program
  .version('0.1.0')
  .option('-p, --http-port <httpPort>', 'Specify http port')
  .option('-a, --ws-address <wsAddress>', 'Specify WebSocket address')
  .option('-w, --ws-port <wsPort>', 'Specify WebSocket port')
  .option('-d, --directory <directory>', 'Specify directory to serve')
  .option('-l, --local', 'Specify if OpenSpace is running on localhost')
  .option(
    '-c, --auto-close',
    'Connect to OpenSpace server and shut down when connection is lost')
  .parse(process.argv);

const httpPort = program.httpPort || 4680;
const wsAddress = program.wsAddress || 'localhost';
const wsPort = program.wsPort || 4682;
const autoClose = program.autoClose;
const local = program.local;
const openSpaceAddress = local ? 'localhost' : wsAddress;
const directory = path.resolve(program.directory || '.');

// Setup static HTTP Server
const app = express();
app.use(express.static(directory));
const server = app.listen(httpPort);

app.get('/environment.js', (req, res) => {
  let address = wsAddress;
  // For local http requests, use local address for websocket as well.
  const clientAddress = req.connection.remoteAddress;
  if (local) {
    if (clientAddress == "localhost" || clientAddress == "127.0.0.1") {
      address = clientAddress;
    }
    if (clientAddress == "::1") {
      address = "localhost";
    }
  }

  res.send(
    'window.OpenSpaceEnvironment = ' +
    JSON.stringify({
      wsAddress: address,
      wsPort: wsPort
    })
  );
});

console.log('Serving OpenSpace GUI');
console.log("  Serving directory: " + directory);
console.log("  Http Port: " + httpPort);
console.log("  WebSocket Address: " + wsAddress);
console.log("  WebSocket Port: " + wsPort);

if (autoClose) {
  // Use WebSocket connection to OpenSpace process
  // to detect when it closes.
  const ws = new WebSocket('ws://' + openSpaceAddress + ':' + wsPort);

  // Connect to OpenSpace process.
  ws.on('open', (connection) => {
    console.log('Connected to local OpenSpace server');

    // Ask the CefWebGui to reload if the module is enabled
    // This is
    ws.send(JSON.stringify(
      {
        topic: 0,
        type: 'luascript',
        payload: {
          script: 'if (openspace.modules.isLoaded("CefWebGui")) then ' +
            'openspace.setPropertyValueSingle("Modules.CefWebGui.Reload", nil) end',
          value: null
        }
      }
    ));
  });

  // Whenever the contact is lost, kill app.
  ws.on('close', () => {
    console.log('Lost conneciton to OpenSpace - Exiting.');
    server.close();
    process.exit();
  });

  ws.on('error', (error) => {
    console.error(error);
    console.log('Connection error: ' + error + ' - Exiting.');
    server.close();
    process.exit();
  });
}