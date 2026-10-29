const Room = require('./Room');
const { pool } = require('../db');

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(roomId, hostId, videoId = '') {
    const room = new Room(roomId, hostId, videoId);
    this.rooms.set(roomId, room);
    this.saveRoomToDb(room).catch(err => {
      console.error('Failed to persist room to db', err.message);
    });
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  deleteRoom(roomId) {
    return this.rooms.delete(roomId);
  }

  findRoomBySocketId(socketId) {
    for (const room of this.rooms.values()) {
      const participant = room.getParticipantBySocketId(socketId);
      if (participant) {
        return { room, participant };
      }
    }
    return { room: null, participant: null };
  }

  async saveRoomToDb(room) {
    try {
      const query = `
        INSERT INTO rooms (room_id, host_id, video_id, play_state, playback_time, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (room_id)
        DO UPDATE SET
          host_id = EXCLUDED.host_id,
          video_id = EXCLUDED.video_id,
          play_state = EXCLUDED.play_state,
          playback_time = EXCLUDED.playback_time,
          updated_at = NOW();
      `;
      await pool.query(query, [
        room.roomId,
        room.hostId,
        room.videoId,
        room.playState,
        room.getAuthoritativeTime()
      ]);
    } catch (error) {
      console.error('Database saveRoom error:', error.message);
    }
  }

  async loadRoomFromDb(roomId) {
    try {
      const res = await pool.query('SELECT * FROM rooms WHERE room_id = $1 LIMIT 1', [roomId]);
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      const room = new Room(row.room_id, row.host_id, row.video_id);
      room.playState = 'paused';
      room.playbackTime = row.playback_time || 0;
      room.lastUpdated = Date.now();
      this.rooms.set(roomId, room);
      return room;
    } catch (error) {
      console.error('Database loadRoom error:', error.message);
      return null;
    }
  }

  async saveChatMessage(roomId, userId, username, role, message) {
    try {
      const query = `
        INSERT INTO chat_messages (room_id, user_id, username, role, message)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, room_id, user_id, username, role, message, created_at;
      `;
      const res = await pool.query(query, [roomId, userId, username, role, message]);
      return res.rows[0];
    } catch (error) {
      console.error('Database saveChatMessage error:', error.message);
      return {
        id: Date.now(),
        room_id: roomId,
        user_id: userId,
        username,
        role,
        message,
        created_at: new Date().toISOString()
      };
    }
  }

  async getRecentChatMessages(roomId, limit = 50) {
    try {
      const query = `
        SELECT id, room_id, user_id, username, role, message, created_at
        FROM chat_messages
        WHERE room_id = $1
        ORDER BY created_at ASC
        LIMIT $2;
      `;
      const res = await pool.query(query, [roomId, limit]);
      return res.rows;
    } catch (error) {
      console.error('Database getRecentChatMessages error:', error.message);
      return [];
    }
  }
}

module.exports = new RoomManager();
