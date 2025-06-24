import amqp from 'amqplib';
import logger from '../utils/logger.js';

class RabbitMQConfig {
  constructor() {
    this.connection = null;
    this.channel = null;
  }

  async connect() {
    try {
      const rabbitMQUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
      
      this.connection = await amqp.connect(rabbitMQUrl);
      this.channel = await this.connection.createChannel();

      logger.info('✅ Conectado ao RabbitMQ');

      this.connection.on('error', (err) => {
        logger.error('❌ Erro na conexão RabbitMQ:', err);
      });

      this.connection.on('close', () => {
        logger.warn('🔌 Conexão RabbitMQ fechada');
        this.connection = null;
        this.channel = null;
      });

      return this.connection;
    } catch (error) {
      logger.error('❌ Erro ao conectar no RabbitMQ:', error);
      throw error;
    }
  }

  async getChannel() {
    if (!this.channel) {
      await this.connect();
    }
    return this.channel;
  }

  async disconnect() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      logger.info('🔌 Desconectado do RabbitMQ');
    } catch (error) {
      logger.error('❌ Erro ao desconectar do RabbitMQ:', error);
    }
  }
}

export default new RabbitMQConfig();