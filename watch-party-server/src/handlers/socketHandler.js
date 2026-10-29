const roomManager = require('../models/RoomManager');
const Participant = require('../models/Participant');

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {

    socket.on('join_room', async ({ roomId, username, userId, initialVideoId }) => {
      try {
        if (!roomId || !username) {
          socket.emit('error_message', { message: 'Room ID and username are required' });
          return;
        }

        const safeUserId = userId || socket.id;
        let room = roomManager.getRoom(roomId);

        if (!room) {
          room = await roomManager.loadRoomFromDb(roomId);
        }

        let assignedRole = 'participant';

        if (!room) {
          if (initialVideoId) {
            assignedRole = 'host';
            room = roomManager.createRoom(roomId, safeUserId, initialVideoId);
          } else {
            socket.emit('error_message', { message: 'Room not found. Invalid room code or link.' });
            return;
          }
        } else {
          const existingParticipant = room.getParticipant(safeUserId);
          if (existingParticipant) {
            assignedRole = existingParticipant.role;
          } else if (room.hostId === safeUserId) {
            assignedRole = 'host';
          }
        }

        const participant = new Participant(safeUserId, socket.id, username, assignedRole);
        room.addParticipant(participant);

        socket.join(roomId);

        socket.emit('joined_successfully', {
          roomId,
          userId: safeUserId,
          role: assignedRole,
          syncState: room.getSyncState(),
          participants: room.getParticipantsList()
        });

        const recentChats = await roomManager.getRecentChatMessages(roomId, 50);
        socket.emit('chat_history', recentChats);

        io.to(roomId).emit('user_joined', {
          username,
          userId: safeUserId,
          role: assignedRole,
          participants: room.getParticipantsList()
        });
      } catch (error) {
        socket.emit('error_message', { message: 'Failed to join room: ' + error.message });
      }
    });

    socket.on('play', ({ roomId, currentTime }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const participant = room.getParticipantBySocketId(socket.id);
      if (!participant || (participant.role !== 'host' && participant.role !== 'moderator')) {
        socket.emit('error_message', { message: 'Playback control requires Host or Moderator role' });
        return;
      }

      room.updatePlayback('playing', currentTime);
      io.to(roomId).emit('sync_state', room.getSyncState());
      roomManager.saveRoomToDb(room);
    });

    socket.on('pause', ({ roomId, currentTime }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const participant = room.getParticipantBySocketId(socket.id);
      if (!participant || (participant.role !== 'host' && participant.role !== 'moderator')) {
        socket.emit('error_message', { message: 'Playback control requires Host or Moderator role' });
        return;
      }

      room.updatePlayback('paused', currentTime);
      io.to(roomId).emit('sync_state', room.getSyncState());
      roomManager.saveRoomToDb(room);
    });

    socket.on('seek', ({ roomId, time }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const participant = room.getParticipantBySocketId(socket.id);
      if (!participant || (participant.role !== 'host' && participant.role !== 'moderator')) {
        socket.emit('error_message', { message: 'Seeking requires Host or Moderator role' });
        return;
      }

      room.updatePlayback(room.playState, time);
      io.to(roomId).emit('sync_state', room.getSyncState());
      roomManager.saveRoomToDb(room);
    });

    socket.on('change_video', ({ roomId, videoId }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const participant = room.getParticipantBySocketId(socket.id);
      if (!participant || (participant.role !== 'host' && participant.role !== 'moderator')) {
        socket.emit('error_message', { message: 'Changing video requires Host or Moderator role' });
        return;
      }

      if (!videoId || typeof videoId !== 'string') return;

      room.setVideo(videoId.trim());
      io.to(roomId).emit('sync_state', room.getSyncState());
      roomManager.saveRoomToDb(room);
    });

    socket.on('assign_role', ({ roomId, targetUserId, role }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const sender = room.getParticipantBySocketId(socket.id);
      if (!sender || sender.role !== 'host') {
        socket.emit('error_message', { message: 'Only the Host can assign roles' });
        return;
      }

      if (!['moderator', 'participant', 'viewer'].includes(role)) {
        socket.emit('error_message', { message: 'Invalid role specified' });
        return;
      }

      const success = room.assignRole(targetUserId, role);
      if (success) {
        const target = room.getParticipant(targetUserId);
        io.to(roomId).emit('role_assigned', {
          targetUserId,
          username: target ? target.username : '',
          role,
          participants: room.getParticipantsList()
        });
      }
    });

    socket.on('transfer_host', ({ roomId, newHostUserId }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const sender = room.getParticipantBySocketId(socket.id);
      if (!sender || sender.role !== 'host') {
        socket.emit('error_message', { message: 'Only the current Host can transfer host privileges' });
        return;
      }

      const success = room.transferHost(newHostUserId);
      if (success) {
        io.to(roomId).emit('role_assigned', {
          targetUserId: newHostUserId,
          role: 'host',
          participants: room.getParticipantsList()
        });
        roomManager.saveRoomToDb(room);
      }
    });

    socket.on('remove_participant', ({ roomId, targetUserId }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const sender = room.getParticipantBySocketId(socket.id);
      if (!sender || sender.role !== 'host') {
        socket.emit('error_message', { message: 'Only the Host can remove participants' });
        return;
      }

      if (targetUserId === room.hostId) {
        socket.emit('error_message', { message: 'Host cannot be removed' });
        return;
      }

      const target = room.getParticipant(targetUserId);
      if (target) {
        io.to(target.socketId).emit('participant_removed', {
          targetUserId,
          reason: 'Removed by host'
        });

        const targetSocket = io.sockets.sockets.get(target.socketId);
        if (targetSocket) {
          targetSocket.leave(roomId);
        }

        room.removeParticipant(targetUserId);

        io.to(roomId).emit('participant_removed', {
          targetUserId,
          participants: room.getParticipantsList()
        });
      }
    });

    socket.on('send_chat', async ({ roomId, message }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const sender = room.getParticipantBySocketId(socket.id);
      if (!sender || !message || !message.trim()) return;

      const chatRecord = await roomManager.saveChatMessage(
        roomId,
        sender.userId,
        sender.username,
        sender.role,
        message.trim()
      );

      io.to(roomId).emit('new_chat', {
        id: chatRecord.id,
        userId: sender.userId,
        username: sender.username,
        role: sender.role,
        message: message.trim(),
        createdAt: chatRecord.created_at
      });
    });

    socket.on('send_reaction', ({ roomId, emoji }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const sender = room.getParticipantBySocketId(socket.id);
      if (!sender || !emoji) return;

      io.to(roomId).emit('new_reaction', {
        id: Date.now() + Math.random().toString(36).substring(2, 6),
        emoji,
        username: sender.username
      });
    });

    socket.on('leave_room', ({ roomId }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const participant = room.getParticipantBySocketId(socket.id);
      if (participant) {
        room.removeParticipant(participant.userId);
        socket.leave(roomId);

        io.to(roomId).emit('user_left', {
          userId: participant.userId,
          username: participant.username,
          participants: room.getParticipantsList()
        });
      }
    });

    socket.on('disconnect', () => {
      const { room, participant } = roomManager.findRoomBySocketId(socket.id);
      if (room && participant) {
        room.removeParticipant(participant.userId);

        io.to(room.roomId).emit('user_left', {
          userId: participant.userId,
          username: participant.username,
          participants: room.getParticipantsList()
        });
      }
    });

  });
}

module.exports = registerSocketHandlers;
