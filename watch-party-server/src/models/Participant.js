class Participant {
  constructor(userId, socketId, username, role = 'participant') {
    this.userId = userId;
    this.socketId = socketId;
    this.username = username;
    this.role = role;
    this.joinedAt = new Date().toISOString();
  }

  setRole(newRole) {
    this.role = newRole;
  }

  setSocketId(newSocketId) {
    this.socketId = newSocketId;
  }

  toJSON() {
    return {
      userId: this.userId,
      username: this.username,
      role: this.role,
      joinedAt: this.joinedAt
    };
  }
}

module.exports = Participant;
