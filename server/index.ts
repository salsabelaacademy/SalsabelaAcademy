import {startEmailWorker} from "./email-delivery";
import { startPushWorker } from "./push";
import { validateEnvironment } from "./environment";
import { pool } from "./db";
import {configureHttp} from "./http";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startWorker } from "./integrations/service";

validateEnvironment();
const app = express();
configureHttp(app);
const httpServer = createServer(app);

export function log(message: string, source = "express") {
  console.log(JSON.stringify({ time:new Date().toISOString(), source, message }));
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(JSON.stringify({method:req.method, route:req.route?.path || "api", status:res.statusCode, durationMs:duration}));
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.name === "ZodError" ? 400 : err.status || err.statusCode || 500;
    const message = status >= 500 ? "Internal Server Error" : err.message || "Request failed";

    console.error(JSON.stringify({event:"request_failed",status}));

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      const stopIntegrationWorker = startWorker();
      const stopPush = startPushWorker();
      const stopEmail = startEmailWorker();
      const stopWorker = () => { stopIntegrationWorker(); stopPush(); stopEmail(); };
      httpServer.once("close", stopWorker);
      for(const signal of ["SIGTERM","SIGINT"] as const) process.once(signal,()=>{stopWorker();httpServer.close(()=>{void pool.end().then(()=>process.exit(0));});setTimeout(()=>process.exit(1),15000).unref();});
    },
  );
})();
