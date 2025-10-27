// Simple server.js for Next.js standalone mode
// This file is needed to start the Next.js production server

const path = require('path');

// Start Next.js server
process.chdir(__dirname);

const NextServer = require('next/dist/server/next-server').default;
const http = require('http');
const { parse } = require('url');

const dev = false;
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT, 10) || 3000;

const server = new NextServer({
  hostname,
  port,
  dir: __dirname,
  dev,
  customServer: false,
  conf: {
    ...require('./.next/required-server-files.json').config,
    distDir: './.next',
  },
});

const requestHandler = server.getRequestHandler();

http.createServer(async (req, res) => {
  try {
    await requestHandler(req, res, parse(req.url, true));
  } catch (err) {
    console.error('Error handling request:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}).listen(port, hostname, () => {
  console.log(`> Ready on http://${hostname}:${port}`);
});
