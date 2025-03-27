#!/usr/bin/env node

const http = require('http');

// Function to send a refresh signal to our server
function notifyServer() {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/tasks/refresh',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': 0
    }
  };

  const req = http.request(options, (res) => {
    console.log(`Hook notification status: ${res.statusCode}`);
  });

  req.on('error', (error) => {
    console.error(`Hook error: ${error.message}`);
  });

  req.end();
}

// Execute notification
notifyServer();

// Taskwarrior hooks need to pass through the JSON they receive
process.stdin.on('data', (data) => {
  process.stdout.write(data);
});