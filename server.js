const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

let queue = [];  // Menyimpan client yang menunggu
let availableCS = [];  // Menyimpan CS yang tersedia

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        let data;
        try {
            data = JSON.parse(message);  // Parsing pesan dari client
        } catch (e) {
            console.error('Invalid JSON received:', message);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON format' }));
            return;
        }

        // Proses pesan berdasarkan tipe
        if (data.type === 'customer') {
            queue.push(ws);
            ws.send(JSON.stringify({ type: 'status', message: 'Waiting for CS' }));
        } else if (data.type === 'cs') {
            availableCS.push(ws);
            ws.send(JSON.stringify({ type: 'status', message: 'CS is available' }));
        } else if (data.type === 'assign' && availableCS.length > 0 && queue.length > 0) {
            let customer = queue.shift();
            let cs = availableCS.shift();

            customer.send(JSON.stringify({ type: 'status', message: 'CS Connected' }));
            cs.send(JSON.stringify({ type: 'status', message: 'Customer Connected' }));

            // Handle pesan antara CS dan customer
            cs.on('message', (msg) => {
                // Kirim pesan dari CS ke Customer
                customer.send(JSON.stringify({ type: 'message', content: `CS: ${msg}` }));
            });

            customer.on('message', (msg) => {
                // Kirim pesan dari Customer ke CS
                cs.send(JSON.stringify({ type: 'message', content: `Customer: ${msg}` }));
            });
        }
    });

    ws.on('close', () => {
        queue = queue.filter(client => client !== ws);
        availableCS = availableCS.filter(cs => cs !== ws);
    });
});

console.log('WebSocket server is running on ws://localhost:8080');
