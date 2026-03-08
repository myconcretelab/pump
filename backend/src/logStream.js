const sseClients = [];

function addClient(client) {
  sseClients.push(client);
}

function removeClient(client) {
  const index = sseClients.indexOf(client);
  if (index !== -1) {
    sseClients.splice(index, 1);
  }
}

function sendToClient(client, data) {
  try {
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch {
    return false;
  }
}

function broadcast(data) {
  if (sseClients.length === 0) {
    return;
  }

  const disconnectedClients = [];
  sseClients.forEach((client) => {
    if (!sendToClient(client, data)) {
      disconnectedClients.push(client);
    }
  });

  disconnectedClients.forEach(removeClient);
}

function broadcastLog(level, message, data = null) {
  broadcast({
    type: 'log',
    level,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
}

function broadcastSessionUpdate(sessionId, status, data = {}) {
  broadcast({
    type: 'session-update',
    sessionId,
    status,
    data,
    timestamp: new Date().toISOString(),
  });
}

export {
  addClient,
  removeClient,
  sendToClient,
  broadcastLog,
  broadcastSessionUpdate,
};
