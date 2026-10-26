import { IncomingMessage } from 'http';
import { Socket } from 'net';
import https from 'https';

/**
 * Node.js Native WebSocket Gateway for Gemini Multimodal Live API.
 * Proxies WebSocket connections from /api/voice/live to the Google Gemini Live API
 * without requiring any third-party dependencies.
 */
export function setupVoiceGateway(server: any) {
  server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const url = req.url || '';
    if (!url.startsWith('/api/voice/live')) {
      return; // Not our route
    }

    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      console.warn("[VoiceGateway] Connection requested but GEMINI_API_KEY is not configured.");
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    console.log("[VoiceGateway] Upgrading connection to WebSocket proxy...");

    // Establish proxy connection to Google Gemini Live API
    // Endpoint: wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidirectionalGenerateContent
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidirectionalGenerateContent?key=${apiKey}`,
      method: 'GET',
      headers: {
        'Connection': 'Upgrade',
        'Upgrade': 'websocket',
        'Sec-WebSocket-Key': req.headers['sec-websocket-key'] || '',
        'Sec-WebSocket-Version': req.headers['sec-websocket-version'] || '13',
      }
    };

    const proxyReq = https.request(options);
    
    proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
      console.log("[VoiceGateway] Proxy tunnel established with Gemini Live API.");
      
      // Complete client handshake
      socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
                   'Upgrade: websocket\r\n' +
                   'Connection: Upgrade\r\n' +
                   `Sec-WebSocket-Accept: ${proxyRes.headers['sec-websocket-accept']}\r\n\r\n`);

      // Forward client data to proxy
      if (proxyHead && proxyHead.length > 0) {
        proxySocket.write(proxyHead);
      }
      if (head && head.length > 0) {
        socket.write(head);
      }

      // Pipe bidirectional streams
      socket.pipe(proxySocket);
      proxySocket.pipe(socket);

      socket.on('error', (err) => {
        console.error("[VoiceGateway] Client socket error:", err.message);
        proxySocket.end();
      });

      proxySocket.on('error', (err) => {
        console.error("[VoiceGateway] Google proxy socket error:", err.message);
        socket.end();
      });
    });

    proxyReq.on('error', (err) => {
      console.error("[VoiceGateway] Proxy request error:", err.message);
      socket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      socket.destroy();
    });

    proxyReq.end();
  });
}
