import amqp from 'amqplib';
import websocketService from './websocketService.js';

class ConsumerService {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.stats = {
      processedMessages: 0,
      failedMessages: 0,
      startTime: new Date()
    };
  }

  async start() {
    try {
      console.log('🐰 Conectando no RabbitMQ...');
      
      // Conectar
      const rabbitURL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
      this.connection = await amqp.connect(rabbitURL);
      this.channel = await this.connection.createChannel();

      console.log('✅ Conectado no RabbitMQ');

      // Configurar QoS
      await this.channel.prefetch(1);

      // Consumir notificações individuais
      await this.consumeNotifications();

      // Consumir notificações em lote
      await this.consumeBulkNotifications();

    } catch (error) {
      console.error('❌ Erro ao iniciar consumer:', error);
      throw error;
    }
  }

  async consumeNotifications() {
    const queueName = 'notifications.send';

    await this.channel.consume(queueName, async (message) => {
      if (!message) return;

      try {
        const data = JSON.parse(message.content.toString());
        console.log(`📨 Processando notificação: ${data.id}`);

        // Processar mensagem
        await this.processNotification(data);

        // Confirmar processamento
        this.channel.ack(message);
        this.stats.processedMessages++;

        console.log(`✅ Notificação processada: ${data.id}`);

      } catch (error) {
        console.error('❌ Erro ao processar notificação:', error);
        this.stats.failedMessages++;
        
        // Rejeitar mensagem (vai para DLQ se configurado)
        this.channel.nack(message, false, false);
      }
    });

    console.log(`🔄 Consumindo fila: ${queueName}`);
  }

  async consumeBulkNotifications() {
    const queueName = 'notifications.bulk';

    await this.channel.consume(queueName, async (message) => {
      if (!message) return;

      try {
        const data = JSON.parse(message.content.toString());
        console.log(`📦 Processando lote: ${data.id}`);

        // Processar lote
        await this.processBulkNotification(data);

        this.channel.ack(message);
        this.stats.processedMessages++;

        console.log(`✅ Lote processado: ${data.id}`);

      } catch (error) {
        console.error('❌ Erro ao processar lote:', error);
        this.stats.failedMessages++;
        this.channel.nack(message, false, false);
      }
    });

    console.log(`🔄 Consumindo fila: ${queueName}`);
  }

  async processNotification(messageData) {
    const { data } = messageData;

    // Criar payload da notificação
    const notification = {
      id: data.notificationId,
      type: 'notification',
      data: {
        title: data.title,
        message: data.message,
        notificationType: data.notificationType || 'alert',
        priority: data.priority || 'normal',
        timestamp: new Date().toISOString()
      }
    };

    // Enviar via WebSocket
    const sent = await websocketService.sendToDevice(data.deviceId, notification);

    if (sent) {
      console.log(`📱 Notificação enviada para: ${data.deviceId}`);
    } else {
      console.log(`📵 Dispositivo offline: ${data.deviceId}`);
    }
  }

  async processBulkNotification(messageData) {
    const { data } = messageData;
    
    console.log(`📦 Processando ${data.deviceIds.length} dispositivos`);

    // Processar cada dispositivo
    for (const deviceId of data.deviceIds) {
      const notification = {
        type: 'notification',
        data: {
          title: data.title,
          message: data.message,
          notificationType: data.notificationType || 'alert',
          priority: data.priority || 'normal',
          timestamp: new Date().toISOString(),
          fromBulk: true
        }
      };

      await websocketService.sendToDevice(deviceId, notification);
    }
  }

  async stop() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      console.log('✅ RabbitMQ desconectado');
    } catch (error) {
      console.error('❌ Erro ao desconectar:', error);
    }
  }

  getStats() {
    return {
      ...this.stats,
      uptime: Math.floor((Date.now() - this.stats.startTime.getTime()) / 1000)
    };
  }
}

export default new ConsumerService();