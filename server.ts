console.log("SERVER BOOTING");

import express from "express";
import path from "path";
import https from "https";

const app = express();

const BACKEND_URL =
  process.env.BACKEND_URL ||
  "https://bluecrestpremium-production.up.railway.app";

console.log("REGISTERING API PROXY");

app.use("/api", (req, res) => {
  console.log("=================================");
  console.log("BACKEND_URL =", BACKEND_URL);
  console.log("METHOD =", req.method);
  console.log("REQ URL =", req.url);
  console.log("TARGET =", `${BACKEND_URL}/api${req.url}`);
  console.log("HEADERS =", req.headers);
  console.log("=================================");

  const backend = new URL(BACKEND_URL);

  const options = {
  hostname: backend.hostname,
  port: 443,
  path: `/api${req.url}`,
  method: req.method,
  headers: {
    "content-type":
      req.headers["content-type"] || "application/json",

    "accept":
      req.headers["accept"] || "*/*",

    "authorization":
      req.headers["authorization"] || ""
  }
};

  console.log("OPTIONS =", options);

  const proxyReq = https.request(
    options,
    (proxyRes) => {
      console.log(
        "BACKEND STATUS =",
        proxyRes.statusCode
      );

      console.log(
        "BACKEND RESPONSE HEADERS =",
        proxyRes.headers
      );

      res.writeHead(
        proxyRes.statusCode || 200,
        proxyRes.headers
      );

      proxyRes.pipe(res, {
        end: true
      });
    }
  );

  proxyReq.on("error", (err: any) => {
    console.error("========== PROXY ERROR ==========");
    console.error(err);
    console.error("NAME:", err?.name);
    console.error("MESSAGE:", err?.message);
    console.error("STACK:", err?.stack);

    if ((err as any)?.rawPacket) {
      console.error(
        "RAW PACKET:",
        (err as any).rawPacket.toString()
      );
    }

    console.error("=================================");

    res.status(502).json({
      error: "Backend unavailable"
    });
  });

  req.pipe(proxyReq, {
    end: true
  });
});

const distPath = path.join(
  process.cwd(),
  "dist"
);

console.log("DIST PATH:", distPath);

app.use(express.static(distPath));

app.get("*", (_, res) => {
  res.sendFile(
    path.join(
      distPath,
      "index.html"
    )
  );
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `Frontend listening on port ${PORT}`
  );
});
