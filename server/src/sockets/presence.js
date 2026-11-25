const online = new Map();

function listOnline() {
  return Array.from(online.values()).map((entry) => entry.user);
}

// A person stays online until their last tab disconnects.
function noteConnect(socket) {
  const id = socket.user.id;
  let entry = online.get(id);
  const isFirst = !entry;
  if (!entry) {
    entry = { user: socket.user, sockets: new Set() };
    online.set(id, entry);
  }
  entry.sockets.add(socket.id);
  return isFirst;
}

function noteDisconnect(socket) {
  const entry = online.get(socket.user.id);
  if (!entry) return false;
  entry.sockets.delete(socket.id);
  if (entry.sockets.size === 0) {
    online.delete(socket.user.id);
    return true;
  }
  return false;
}

function resetPresence() {
  online.clear();
}

module.exports = { listOnline, noteConnect, noteDisconnect, resetPresence };
