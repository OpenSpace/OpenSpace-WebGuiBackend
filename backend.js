const express = require('express');
const program = require('commander');
const WebSocket = require('ws');
const flatMap = require('flatmap');

program
  .version('0.1.0')
  .option('-p, --http-port <httpPort>', 'Specify http port')
  .option('-a, --ws-address <wsAddress>', 'Specify WebSocket address')
  .option('-w, --ws-port <wsPort>', 'Specify WebSocket port')
  .option('-d, --directories <directories>', 'Specify directories to serve, on the format \'["endpoint1", "path1", "endpoint2, "path2",...]\'')
  .option('-l, --local', 'Specify if OpenSpace is running on 127.0.0.1')
  .option(
    '-c, --auto-close',
    'Connect to OpenSpace server and shut down when connection is lost')
  .parse(process.argv);

const httpPort = program.httpPort || 4680;
const wsAddress = program.wsAddress || '127.0.0.1';
const wsPort = program.wsPort || 4682;
const autoClose = program.autoClose;
const local = program.local;
const openSpaceAddress = local ? '127.0.0.1' : wsAddress;
const directories = program.directories || '[]';

// Setup static HTTP Server
const app = express();

let endpoints = {};
try {
  const endpointList = JSON.parse(directories);
  for (let i = 0; i < endpointList.length - 1; i += 2) {
    endpoints[endpointList[i]] = endpointList[i + 1];
  }
} catch (e) {
  console.error("Failed to parse endpoints: ", directories, e);
  process.exit();
}

Object.entries(endpoints).forEach(pair => {
  if (typeof pair[1] !== 'string') {
    console.error('Expected ', pair[1], ' to be a string');
    delete endpoints[pair[0]];
    return;
  }
  app.use("/" + pair[0], express.static(pair[1]));
});

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
      address = "127.0.0.1";
    }
  }

  res.send(
    'window.OpenSpaceEnvironment = ' +
    JSON.stringify({
      wsAddress: address,
      wsPort: wsPort,
    })
  );
});

app.get('/', (req, res) => {
  res.send(
    "<h1>OpenSpace Endpoints</h1>" +
    Object.entries(endpoints).map(pair => `<li><a href="/${pair[0]}">${pair[0]}</a></li>`).join('')
  );
})

console.log('Serving OpenSpace web content');
console.log("  Serving directories: ");
Object.entries(endpoints).forEach(pair => {
  console.log(`    ${pair[0]} : ${pair[1]}`);
});
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

    // Notify OpenSpace about which directories that are served.
    ws.send(JSON.stringify(
      {
        topic: 0,
        type: 'set',
        payload: {
          property: 'Modules.WebGui.ServedDirectories',
          value: flatMap(Object.entries(endpoints), p => [p[0], p[1]]
          )
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