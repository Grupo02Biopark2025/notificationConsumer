import { parse } from 'url';

class WebSocketService {
  constructor() {
    this.connections = new Map(); // deviceId -> WebSocket
  }

  initialize(wss) {
    this.wss = wss;

    wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    console.log('📡 WebSocket Server iniciado');
  }

  handleConnection(ws, request) {
    try {
      // Extrair deviceId da URL
      const { query } = parse(request.url, true);
      const deviceId = query.deviceId;

      if (!deviceId) {
        console.log('❌ Conexão rejeitada: deviceId não fornecido');
        ws.close(4000, 'deviceId é obrigatório');
        return;
      }

      console.log(`📱 Dispositivo conectado: ${deviceId}`);

      // Fechar conexão anterior se existir
      if (this.connections.has(deviceId)) {
        const oldWs = this.connections.get(deviceId);
        if (oldWs.readyState === 1) {
          oldWs.close();
        }
      }

      // Adicionar nova conexão
      this.connections.set(deviceId, ws);
      ws.deviceId = deviceId;

      // Handlers
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, deviceId, message);
        } catch (error) {
          console.error(`❌ Erro ao processar mensagem de ${deviceId}:`, error);
        }
      });

      ws.on('close', () => {
        this.connections.delete(deviceId);
        console.log(`📱 Dispositivo desconectado: ${deviceId}`);
      });

      ws.on('error', (error) => {
        console.error(`❌ Erro WebSocket ${deviceId}:`, error);
        this.connections.delete(deviceId);
      });

      // Enviar mensagem de boas-vindas
      this.sendWelcome(deviceId);

    } catch (error) {
      console.error('❌ Erro ao processar conexão:', error);
      ws.close(4500, 'Erro interno');
    }
  }

  handleMessage(ws, deviceId, message) {
    console.log(`📨 Mensagem de ${deviceId}:`, message.type);

    switch (message.type) {
      case 'ping':
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: new Date().toISOString()
        }));
        break;

      case 'notification_received':
        console.log(`✅ Notificação confirmada por ${deviceId}:`, message.notificationId);
        break;

      default:
        console.log(`⚠️ Tipo desconhecido: ${message.type}`);
    }
  }

  async sendToDevice(deviceId, message) {
    try {
      const ws = this.connections.get(deviceId);

      if (!ws || ws.readyState !== 1) {
        return false; // Dispositivo offline
      }

      const payload = JSON.stringify({
        timestamp: new Date().toISOString(),
        ...message
      });

      ws.send(payload);
      console.log(`📤 Enviado para ${deviceId}: ${message.type}`);
      
      return true;

    } catch (error) {
      console.error(`❌ Erro ao enviar para ${deviceId}:`, error);
      this.connections.delete(deviceId);
      return false;
    }
  }

  sendWelcome(deviceId) {
    const welcomeMessage = {
      type: 'welcome',
      data: {
        message: 'Conectado ao sistema MDM!',
        deviceId,
        timestamp: new Date().toISOString()
      }
    };

    this.sendToDevice(deviceId, welcomeMessage);
  }

  broadcast(message) {
    let sentCount = 0;

    for (const [deviceId, ws] of this.connections) {
      if (ws.readyState === 1) {
        try {
          const payload = JSON.stringify({
            timestamp: new Date().toISOString(),
            ...message
          });
          
          ws.send(payload);
          sentCount++;
        } catch (error) {
          console.error(`❌ Erro ao enviar broadcast para ${deviceId}:`, error);
          this.connections.delete(deviceId);
        }
      }
    }

    console.log(`📢 Broadcast enviado para ${sentCount} dispositivos`);
    return sentCount;
  }

  getConnectionCount() {
    return this.connections.size;
  }

  getConnectedDevices() {
    return Array.from(this.connections.keys());
  }

  isDeviceConnected(deviceId) {
    const ws = this.connections.get(deviceId);
    return ws && ws.readyState === 1;
  }
}

export default new WebSocketService();