import pty from "@lydell/node-pty"
import { serve } from "@hono/node-server"
import { serveStatic } from "@hono/node-server/serve-static"
import { Hono } from "hono"
import os from "node:os"
import { Server } from "socket.io"

const app = new Hono()

app.use("/*", serveStatic({ root: "./public" }))

const PORT = Number(process.env.PORT ?? 3000)

// serve() returns an http.Server — Socket.IO attaches its WebSocket upgrade
// handler after the fact, which works fine even on an already-listening server.
const server = serve({ fetch: app.fetch, port: PORT })
const io = new Server(server)

io.on("connection", (socket) => {
  console.log("A user connected")

  const shell = os.platform() === "win32" ? "powershell.exe" : "bash"

  const ptyProcess = pty.spawn(shell, [], {
    cols: 80,
    cwd: process.env.HOME,
    env: process.env as Record<string, string>,
    name: "xterm-color",
    rows: 30,
  })

  ptyProcess.onData((data) => {
    socket.emit("output", data)
  })

  socket.on("input", (input) => {
    ptyProcess.write(input)
  })

  socket.on("disconnect", () => {
    ptyProcess.kill()
    console.log("User disconnected")
  })
})
