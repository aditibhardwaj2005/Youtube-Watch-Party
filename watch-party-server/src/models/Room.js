class Room {
  constructor(roomId, hostId, videoId = '') {
    this.roomId = roomId;
    this.hostId = hostId;
    this.videoId = videoId;
    this.playState = 'paused';
    this.playbackTime = 0;
    this.lastUpdated = Date.now();
    this.participants = new Map();
  }

  addParticipant(participant) {
    this.participants.set(participant.userId, participant);
  }

  removeParticipant(userId) {
    return this.participants.delete(userId);
  }

  getParticipant(userId) {
    return this.participants.get(userId);
  }

  getParticipantBySocketId(socketId) {
    for (const participant of this.participants.values()) {
      if (participant.socketId === socketId) {
        return participant;
      }
    }
    return null;
  }

  getParticipantsList() {
    return Array.from(this.participants.values()).map(p => p.toJSON());
  }

  getAuthoritativeTime() {
    if (this.playState === 'playing') {
      const elapsedSeconds = (Date.now() - this.lastUpdated) / 1000;
      return Math.max(0, this.playbackTime + elapsedSeconds);
    }
    return Math.max(0, this.playbackTime);
  }

  updatePlayback(playState, currentTime) {
    if (typeof currentTime === 'number' && !isNaN(currentTime)) {
      this.playbackTime = Math.max(0, currentTime);
    } else {
      this.playbackTime = this.getAuthoritativeTime();
    }
    this.playState = playState;
    this.lastUpdated = Date.now();
  }

  setVideo(videoId) {
    this.videoId = videoId;
    this.playState = 'paused';
    this.playbackTime = 0;
    this.lastUpdated = Date.now();
  }

  assignRole(targetUserId, newRole) {
    const target = this.participants.get(targetUserId);
    if (!target) return false;
    if (targetUserId === this.hostId) return false;
    target.setRole(newRole);
    return true;
  }

  transferHost(newHostUserId) {
    const newHost = this.participants.get(newHostUserId);
    if (!newHost) return false;

    const oldHost = this.participants.get(this.hostId);
    if (oldHost) {
      oldHost.setRole('moderator');
    }

    newHost.setRole('host');
    this.hostId = newHostUserId;
    return true;
  }

  getSyncState() {
    return {
      videoId: this.videoId,
      playState: this.playState,
      currentTime: this.getAuthoritativeTime(),
      serverTime: Date.now()
    };
  }

  toJSON() {
    return {
      roomId: this.roomId,
      hostId: this.hostId,
      videoId: this.videoId,
      playState: this.playState,
      currentTime: this.getAuthoritativeTime(),
      participants: this.getParticipantsList()
    };
  }
}

module.exports = Room;
