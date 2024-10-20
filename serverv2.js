const express = require('express');
const WebSocket = require('ws');
const app = express();
const port = 3000;

// Serve static files (HTML, CSS)
app.use(express.static('public'));

// Start WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

let clients = []; // List of clients and their states
let csClients = [];

// Function to send a message to a specific WebSocket client
function sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

// Function to broadcast to CS clients
function broadcastToCS(message) {
    csClients.forEach((cs) => {
        sendMessage(cs, message);
    });
}

// Function to find a client by their WebSocket
function findClient(ws) {
    return clients.find((client) => client.ws === ws);
}

// WebSocket connection handler
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        // Register as client or CS
        if (data.type === 'register') {
            if (data.role === 'client') {
                var numr = Math.floor(Math.random() * 90000) + 10000;
                // Register client
                const newClient = {
                    ws,
                    id: `CBM${numr}`,
                    name: 'Bambang',
                    photo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQrzZLNFqhkJmOgLtXKcUlCVueKbeOUSyvMKw&s',
                    accepted: false, // Not yet accepted by CS
                    chatHistory: [], // Store chat history for this client
                    is_online: true
                };
                clients.push(newClient);
                broadcastToCS({ type: 'new-client', clientId: newClient.id, name: newClient.name, photo: newClient.photo, online: newClient.is_online });
            } else if (data.role === 'cs') {
                // Register CS
                csClients.push(ws);
                sendMessage(ws, { type: 'status', message: 'You are connected as a CS' });
            }
        } else if (data.type === 'accept-client') {
            // CS accepts client
            const client = clients.find((client) => client.id === data.clientId);
            if (client) {
                client.accepted = true;
                sendMessage(client.ws, { type: 'accepted' });
            }
        } else if (data.type === 'message') {
            // Handle message between client and CS
            const client = findClient(ws);

            if (client && client.accepted) {
                // Append message to chat history
                client.chatHistory.push({ from: 'client', message: data.message, created: data.created, timeStamp: data.timeStamp, lastMessage: data.message });
                // Send message to all CS clients
                broadcastToCS({ type: 'message', message: data.message, from: 'client', clientId: client.id, created: data.created, timeStamp: data.timeStamp, lastMessage: data.message });
            } else {
                // CS is sending message to specific client
                const targetClient = clients.find((client) => client.id === data.clientId);
                if (targetClient) {
                    targetClient.chatHistory.push({ from: 'cs', message: data.message, created: data.created, timeStamp: data.timeStamp, lastMessage: data.message });
                    sendMessage(targetClient.ws, { type: 'message', message: data.message, from: 'cs', created: data.created, timeStamp: data.timeStamp, lastMessage: data.message });
                }
            }
        } else if (data.type === 'typing') {
            // Update typing status
            const client = findClient(ws);
            if (client) {
                client.is_typing = data.typing;
                broadcastToCS({ type: 'typing', clientId: client.id, typing: data.typing });
            }
        }
    });

    // Handle WebSocket closing
    ws.on('close', () => {
        const client = findClient(ws);
        if (client) {
            // Set client as offline
            client.is_online = false;
            broadcastToCS({ type: 'status', clientId: client.id, online: false });
        }
        clients = clients.filter((client) => client.ws !== ws);
        csClients = csClients.filter((cs) => cs !== ws);
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
