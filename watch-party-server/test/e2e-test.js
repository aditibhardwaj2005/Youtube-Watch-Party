const { io } = require('socket.io-client');
const assert = require('assert');

const SERVER_URL = 'http://localhost:5001';
const TEST_ROOM_ID = 'test_' + Date.now();

function waitForConnect(socket) {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve) => socket.once('connect', resolve));
}

async function runTests() {
  console.log('--- Starting Watch Party E2E Verification Tests ---');

  const hostSocket = io(SERVER_URL, {
    transports: ['websocket'],
    autoConnect: true
  });

  const participantSocket = io(SERVER_URL, {
    transports: ['websocket'],
    autoConnect: true
  });

  await waitForConnect(hostSocket);
  await waitForConnect(participantSocket);
  console.log('✓ Both sockets connected to server');

  const hostJoinedPromise = new Promise((resolve) => {
    hostSocket.once('joined_successfully', (data) => {
      assert.strictEqual(data.role, 'host', 'Creator must be assigned Host role');
      resolve(data);
    });
  });

  hostSocket.emit('join_room', {
    roomId: TEST_ROOM_ID,
    username: 'HostAlex',
    userId: 'user_host_1',
    initialVideoId: 'test_video_123'
  });

  await hostJoinedPromise;
  console.log('✓ Host joined room and assigned "host" role');

  const participantJoinedPromise = new Promise((resolve) => {
    participantSocket.once('joined_successfully', (data) => {
      assert.strictEqual(data.role, 'participant', 'Second joiner must be assigned Participant role');
      resolve(data);
    });
  });

  participantSocket.emit('join_room', {
    roomId: TEST_ROOM_ID,
    username: 'UserJordan',
    userId: 'user_part_2'
  });

  await participantJoinedPromise;
  console.log('✓ Participant joined room and assigned "participant" role');

  const syncPlayPromise = new Promise((resolve) => {
    participantSocket.once('sync_state', (state) => {
      assert.strictEqual(state.playState, 'playing');
      assert.strictEqual(state.currentTime, 45);
      resolve(state);
    });
  });

  hostSocket.emit('play', { roomId: TEST_ROOM_ID, currentTime: 45 });
  await syncPlayPromise;
  console.log('✓ Play event synced across room');

  const syncPausePromise = new Promise((resolve) => {
    participantSocket.once('sync_state', (state) => {
      assert.strictEqual(state.playState, 'paused');
      resolve(state);
    });
  });

  hostSocket.emit('pause', { roomId: TEST_ROOM_ID, currentTime: 50 });
  await syncPausePromise;
  console.log('✓ Pause event synced across room');

  const syncSeekPromise = new Promise((resolve) => {
    participantSocket.once('sync_state', (state) => {
      assert.strictEqual(state.currentTime, 120);
      resolve(state);
    });
  });

  hostSocket.emit('seek', { roomId: TEST_ROOM_ID, time: 120 });
  await syncSeekPromise;
  console.log('✓ Seek event synced across room');

  const syncChangeVideoPromise = new Promise((resolve) => {
    participantSocket.once('sync_state', (state) => {
      assert.strictEqual(state.videoId, 'jfKfPfyJRdk');
      resolve(state);
    });
  });

  hostSocket.emit('change_video', { roomId: TEST_ROOM_ID, videoId: 'jfKfPfyJRdk' });
  await syncChangeVideoPromise;
  console.log('✓ Change video synced across room');

  const unauthorizedRejectPromise = new Promise((resolve) => {
    participantSocket.once('error_message', (err) => {
      assert(err.message.includes('Playback control requires Host or Moderator role'));
      resolve(err);
    });
  });

  participantSocket.emit('play', { roomId: TEST_ROOM_ID, currentTime: 0 });
  await unauthorizedRejectPromise;
  console.log('✓ Participant playback attempt correctly rejected with permission error');

  const roleAssignedPromise = new Promise((resolve) => {
    participantSocket.once('role_assigned', (data) => {
      assert.strictEqual(data.targetUserId, 'user_part_2');
      assert.strictEqual(data.role, 'moderator');
      resolve(data);
    });
  });

  hostSocket.emit('assign_role', {
    roomId: TEST_ROOM_ID,
    targetUserId: 'user_part_2',
    role: 'moderator'
  });

  await roleAssignedPromise;
  console.log('✓ Host promoted participant to "moderator"');

  const modPlayPromise = new Promise((resolve) => {
    hostSocket.once('sync_state', (state) => {
      assert.strictEqual(state.playState, 'playing');
      resolve(state);
    });
  });

  participantSocket.emit('play', { roomId: TEST_ROOM_ID, currentTime: 10 });
  await modPlayPromise;
  console.log('✓ Promoted moderator now successfully controls playback');

  const chatPromise = new Promise((resolve) => {
    hostSocket.once('new_chat', (chat) => {
      assert.strictEqual(chat.message, 'Hello everyone from test!');
      resolve(chat);
    });
  });

  participantSocket.emit('send_chat', {
    roomId: TEST_ROOM_ID,
    message: 'Hello everyone from test!'
  });

  await chatPromise;
  console.log('✓ Real-time chat message delivered and verified');

  const reactionPromise = new Promise((resolve) => {
    hostSocket.once('new_reaction', (reaction) => {
      assert.strictEqual(reaction.emoji, '🔥');
      resolve(reaction);
    });
  });

  participantSocket.emit('send_reaction', {
    roomId: TEST_ROOM_ID,
    emoji: '🔥'
  });

  await reactionPromise;
  console.log('✓ Emoji reaction broadcast and verified');

  const removePromise = new Promise((resolve) => {
    participantSocket.once('participant_removed', (data) => {
      resolve(data);
    });
  });

  hostSocket.emit('remove_participant', {
    roomId: TEST_ROOM_ID,
    targetUserId: 'user_part_2'
  });

  await removePromise;
  console.log('✓ Participant removed / kicked by host verified');

  hostSocket.disconnect();
  participantSocket.disconnect();

  console.log('--- ALL E2E VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
