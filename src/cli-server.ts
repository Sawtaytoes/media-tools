import pty from "@lydell/node-pty"
import { serve } from "@hono/node-server"
import { serveStatic } from "@hono/node-server/serve-static"
import { Hono } from "hono"
import os from "node:os"
import { Server } from "socket.io"

import { logInfo } from "./logMessage.js"

const app = new Hono()

app.use("/*", serveStatic({ root: "./public" }))

const CLI_SERVER_PORT = Number(process.env.CLI_SERVER_PORT ?? 3002)

// serve() returns an http.Server — Socket.IO attaches its WebSocket upgrade
// handler after the fact, which works fine even on an already-listening server.
const server = serve({ fetch: app.fetch, port: CLI_SERVER_PORT })
const io = new Server(server)

logInfo(
  "CLI Server listening on port:",
  CLI_SERVER_PORT,
)

io.on("connection", (socket) => {
  logInfo("A user connected")

  const shell = os.platform() === "win32" ? "powershell.exe" : "bash"

  const terminal = pty.spawn(shell, [], {
    cols: 80,
    cwd: process.env.HOME,
    env: process.env as Record<string, string>,
    name: "xterm-color",
    rows: 30,
  })

  // For Docker. TODO: Make this use an env var to trigger the Docker directory change.
  if (os.platform() !== "win32") {
    terminal.write("cd /app\r")
  }

  terminal.onData((data) => {
    socket.emit("output", data)
  })

  socket.on("input", (input) => {
    terminal.write(input)
  })

  socket.on("disconnect", () => {
    terminal.kill()
    logInfo("User disconnected")
  })
})
