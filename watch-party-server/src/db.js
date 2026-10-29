const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  ssl: {
    rejectUnauthorized: false
  }
});

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        room_id VARCHAR(50) PRIMARY KEY,
        host_id VARCHAR(100) NOT NULL,
        video_id VARCHAR(50) NOT NULL,
        play_state VARCHAR(20) NOT NULL DEFAULT 'paused',
        playback_time DOUBLE PRECISION NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        room_id VARCHAR(50) NOT NULL,
        user_id VARCHAR(100) NOT NULL,
        username VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    return true;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initializeDatabase
};
