import http from 'node:http'
import handler from '../api/index.js'

const PORT = Number(process.env.PORT || 3001)
const HOST = process.env.HOST || '127.0.0.1'

const server = http.createServer((req, res) => handler(req, res))
server.listen(PORT, HOST, () => {
  process.stdout.write(`API server running on http://${HOST}:${PORT}\n`)
})
