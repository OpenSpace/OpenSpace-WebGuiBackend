import { program } from "commander";
import express, { Request, Response } from "express";
import WebSocket from "ws";
import setupShowbuilderRoutes from "./showbuilder";

program
  .name("WebGui-Backend")
  .version("1.0.0")
  .option("-p, --http-port <httpPort>", "Specify http port")
  .option("-a, --ws-address <wsAddress>", "Specify WebSocket address")
  .option("-w, --ws-port <wsPort>", "Specify WebSocket port")
  .option(
    "-d, --directories <directories>",
    'Specify directories to serve, on the format \'["endpoint1", "path1", "endpoint2, "path2",...]\''
  )
  .option("-l, --local", "Specify if OpenSpace is running on 127.0.0.1")
  .option(
    "-r, --redirect <endpoint>",
    "Specify which of the endpoints that should recieve redirects from the base url (/)"
  )
  .option(
    "-c, --auto-close",
    "Connect to OpenSpace server and shut down when connection is lost"
  )
  .parse();

const opts = program.opts();
const httpPort: number = Number(opts.httpPort) || 4680;
const wsAddress: string = opts.wsAddress || "127.0.0.1";
const wsPort: number = Number(opts.wsPort) || 4682;
const autoClose: boolean = !!opts.autoClose;
const local: boolean = !!opts.local;
const redirect: string = opts.redirect || "endpoints";
const openSpaceAddress: string = local ? "127.0.0.1" : wsAddress;
const directoriesOpt: string = opts.directories || "[]";

// Setup static HTTP Server
const app = express();

let endpoints: Record<string, string> = {};
try {
  console.log("Directories: ", directoriesOpt);
  const endpointList: unknown[] = JSON.parse(directoriesOpt);
  console.log("Endpoint List: ", endpointList);
  for (let i = 0; i < endpointList.length - 1; i += 2) {
    endpoints[String(endpointList[i])] = String(endpointList[i + 1]);
  }
  console.log("Endpoints: ", endpoints);
} catch (e) {
  console.error("Failed to parse endpoints: ", directoriesOpt, e);
  process.exit();
}

function isValidEndpoint(route: string, dir: string): boolean {
  if (typeof dir !== "string") {
    console.error("Expected ", dir, " to be a string");
    return false;
  }
  if (route == "endpoints") {
    console.error(
      '"endpoints" is a reserved endpoint to list available endpoints'
    );
    return false;
  }
  return true;
}

// For all the endpoints, validate and serve the directories
Object.entries(endpoints).forEach(([route, dir]) => {
  if (!isValidEndpoint(route, dir)) {
    delete endpoints[route];
    return;
  }
  const staticMiddleware = express.static(dir);
  const mountPath = route === "/" ? "/" : `/${route}`;

  app.use(mountPath, staticMiddleware);
});

if (Object.keys(endpoints).length === 0) {
  console.log("No directories to serve. Use --help for more info.");
  process.exit();
}

// Extract showbuilder specific endpoints
const showbuilderEndpoints = {
  uploads: endpoints["showcomposer/uploads"],
  projects: endpoints["showcomposer/projects"],
};
// Call the function to set up file upload routes
(async () => {
  await setupShowbuilderRoutes(app, showbuilderEndpoints);
})();

const server = app.listen(httpPort);

app.get("/environment.js", (req: Request, res: Response) => {
  let address = wsAddress;
  // For local http requests, use local address for websocket as well.
  const clientAddress = req.socket.remoteAddress;
  if (local) {
    if (clientAddress == "localhost" || clientAddress == "127.0.0.1") {
      address = clientAddress;
    }
    if (clientAddress == "::1") {
      address = "127.0.0.1";
    }
  }

  res.send(
    "window.OpenSpaceEnvironment = " +
      JSON.stringify({
        wsAddress: address,
        wsPort: wsPort,
      })
  );
});

app.get("/endpoints", (req: Request, res: Response) => {
  res.send(
    "<h1>OpenSpace Endpoints</h1>" +
      Object.entries(endpoints)
        .map((pair) => `<li><a href="/${pair[0]}">${pair[0]}</a></li>`)
        .join("")
  );
});

app.get("/", (req: Request, res: Response) => {
  res.redirect("/" + redirect);
});

console.log("Serving OpenSpace web content");
console.log("  Serving directories: ");
Object.entries(endpoints).forEach((pair) => {
  console.log(`    ${pair[0]} : ${pair[1]}`);
});
console.log("  Http Port: " + httpPort);
console.log("  WebSocket Address: " + wsAddress);
console.log("  WebSocket Port: " + wsPort);

if (autoClose) {
  // Use WebSocket connection to OpenSpace process
  // to detect when it closes.
  const ws = new WebSocket("ws://" + openSpaceAddress + ":" + wsPort);

  // Connect to OpenSpace process.
  ws.on("open", () => {
    console.log("Connected to local OpenSpace server");

    ws.send(
      JSON.stringify({
        type: "apiHandshake",
        apiVersion: {
          major: 1,
          minor: 0,
          patch: 0,
        },
      })
    );

    // Notify OpenSpace about which directories that are served.
    ws.send(
      JSON.stringify({
        topic: 0,
        type: "set",
        payload: {
          property: "Modules.WebGui.ServedDirectories",
          value: Object.entries(endpoints).flatMap((p) => [p[0], p[1]]),
        },
      })
    );
  });

  // Whenever the contact is lost, kill app.
  ws.on("close", () => {
    console.log("Lost conneciton to OpenSpace - Exiting.");
    server.close();
    process.exit();
  });

  ws.on("error", (error: Error) => {
    console.error(error);
    console.log("Connection error: " + error + " - Exiting.");
    server.close();
    process.exit();
  });
}
