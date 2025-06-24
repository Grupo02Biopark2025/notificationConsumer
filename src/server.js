import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import consumerService from './services/consumerService.js';
import websocketService from './services/websocketService.js';

dotenv.config();

const app = express();
const server = createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ 
  server,
  path: '/ws'
});

// Configurar WebSocket
websocketService.initialize(wss);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'notification-consumer',
    timestamp: new Date().toISOString(),
    connections: websocketService.getConnectionCount()
  });
});

// Stats
app.get('/stats', (req, res) => {
  res.json({
    success: true,
    stats: consumerService.getStats(),
    websocket: {
      totalConnections: websocketService.getConnectionCount(),
      connectedDevices: websocketService.getConnectedDevices()
    }
  });
});

async function start() {
  try {
    const PORT = process.env.PORT || 3001;

    console.log('🚀 Iniciando Consumer...');

    // Iniciar consumer RabbitMQ
    await consumerService.start();

    // Iniciar servidor
    server.listen(PORT, () => {
      console.log(`✅ Consumer rodando na porta ${PORT}`);
      console.log(`📊 Health: http://localhost:${PORT}/health`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('📤 Parando consumer...');
      await consumerService.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Erro ao iniciar:', error);
    process.exit(1);
  }
}

start();