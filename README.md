# YouTube Watch Party System

A full-stack, real-time synchronized YouTube watch party application with role-based access control (RBAC), live chat, and interactive floating emoji reactions.

---

## 🌟 Key Features

1. **Real-Time Video Synchronization**:
   - Sub-100ms play, pause, seek, and video-change synchronization across all participants using Socket.IO.
   - Server-authoritative playback timing calculation with automatic drift detection and correction (>1.5s threshold).
   - Cyclic feedback loop protection preventing echo events.

2. **Role-Based Access Control (RBAC)**:
   - **Host** (Room creator): Full control over playback (play, pause, seek, change video), role assignment (promote/demote moderators), participant removal (kick), and host transfer.
   - **Moderator**: Full control over video playback (play, pause, seek, change video).
   - **Participant**: Watch-only experience. Controls are safely disabled; playback auto-syncs to the Host in real-time. Manual "Catch Up" re-sync button available.

3. **Backend-Enforced Security**:
   - All state-altering events (`play`, `pause`, `seek`, `change_video`, `assign_role`, `remove_participant`, `transfer_host`) are strictly validated on the backend. Unauthorized requests are rejected immediately with an informative error broadcast.

4. **OOP Server Architecture**:
   - Clean, modular object-oriented design featuring `RoomManager`, `Room`, and `Participant` classes.

5. **PostgreSQL Persistence**:
   - Rooms and chat message histories are persisted in PostgreSQL (configured for Supabase).

6. **Interactive Real-Time UI**:
   - Dark modern aesthetics built with Next.js 16 and Tailwind CSS.
   - Real-time room chat with role badges and timestamps.
   - Live floating emoji reactions with smooth upward physics over the video player.

---

## 🏛️ Architecture & WebSocket Flow

```
                      +-----------------------------+
                      |   YouTube Watch Party Client |
                      |    (Next.js / Tailwind CSS)  |
                      +--------------+--------------+
                                     |
               WebSocket Connections | Bi-directional Events
                                     v
                      +-----------------------------+
                      |     WebSocket Server        |
                      |   (Node.js / Express / IO)  |
                      |                             |
                      | +-------------------------+ |
                      | |     RBAC Middleware     | |
                      | +-------------------------+ |
                      | |   RoomManager (OOP)     | |
                      | |   - Room instances      | |
                      | |   - Participant states  | |
                      | +-------------------------+ |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |     PostgreSQL Database     |
                      |  (Persistent Rooms & Chat)  |
                      +-----------------------------+
```

### WebSocket Event Contract

| Event | Direction | Payload | Description | Role Required |
| :--- | :--- | :--- | :--- | :--- |
| `join_room` | Client &rarr; Server | `{ roomId, username, userId }` | Joins room. Creator gets `host`, others get `participant`. | Anyone |
| `leave_room` | Client &rarr; Server | `{ roomId }` | Leaves room and broadcasts departure. | Anyone |
| `sync_state` | Server &rarr; Client | `{ videoId, playState, currentTime, serverTime }` | Authoritative playback state sent on join and state updates. | - |
| `play` | Client &rarr; Server | `{ roomId, currentTime }` | Triggers playback. | Host, Moderator |
| `pause` | Client &rarr; Server | `{ roomId, currentTime }` | Pauses playback. | Host, Moderator |
| `seek` | Client &rarr; Server | `{ roomId, time }` | Scrubs playback time. | Host, Moderator |
| `change_video` | Client &rarr; Server | `{ roomId, videoId }` | Changes YouTube video ID or URL. | Host, Moderator |
| `assign_role` | Client &rarr; Server | `{ roomId, targetUserId, role }` | Updates participant role. | Host only |
| `remove_participant` | Client &rarr; Server | `{ roomId, targetUserId }` | Kicks user from room. | Host only |
| `transfer_host` | Client &rarr; Server | `{ roomId, newHostUserId }` | Transfers host ownership. | Host only |
| `send_chat` | Client &rarr; Server | `{ roomId, message }` | Sends room message. | Anyone |
| `send_reaction` | Client &rarr; Server | `{ roomId, emoji }` | Sends floating reaction emoji. | Anyone |
| `user_joined` | Server &rarr; Client | `{ username, userId, role, participants }` | Broadcasted when a new user joins. | - |
| `user_left` | Server &rarr; Client | `{ userId, username, participants }` | Broadcasted when a user disconnects. | - |
| `role_assigned` | Server &rarr; Client | `{ targetUserId, role, participants }` | Broadcasted on role modification. | - |
| `participant_removed` | Server &rarr; Client | `{ targetUserId, participants }` | Broadcasted when a participant is kicked. | - |
| `new_chat` | Server &rarr; Client | `{ id, username, role, message, createdAt }` | Broadcasted when a new chat arrives. | - |
| `new_reaction` | Server &rarr; Client | `{ id, emoji, username }` | Broadcasted when a reaction is sent. | - |
| `error_message` | Server &rarr; Client | `{ message }` | Emitted when an unauthorized action is rejected. | - |

---

## 🚀 Setup & Local Execution

### Prerequisites
- Node.js (v18+ recommended)
- npm

### 1. Start the Backend Server (`watch-party-server`)
```bash
cd watch-party-server
npm install
npm run dev
```
The backend server runs on `http://localhost:5001`.

### 2. Start the Frontend Client (`watch-party-client`)
Open a new terminal tab:
```bash
cd watch-party-client
npm install
npm run dev
```
The frontend client runs on `http://localhost:3000`.

### 3. Running Automated E2E Verification
To run the automated multi-client role enforcement and synchronization test suite:
```bash
cd watch-party-server
node test/e2e-test.js
```

---

## 🌐 Deployment Instructions

### Deploying the Backend (`watch-party-server`) to Render
1. Create a **Web Service** on [Render](https://render.com).
2. Connect your repository and set the **Root Directory** to `watch-party-server`.
3. Set **Build Command**: `npm install`.
4. Set **Start Command**: `npm start`.
5. Add the Environment Variables:
   - `PORT`: `5001`
   - `CLIENT_ORIGIN`: Your frontend URL (or `*`)
   - `POSTGRES_USER`: Database username
   - `POSTGRES_HOST`: Database host
   - `POSTGRES_DB`: Database name
   - `POSTGRES_PASSWORD`: Database password
   - `POSTGRES_PORT`: `5432`

### Deploying the Frontend (`watch-party-client`) to Vercel
1. Import your repository into [Vercel](https://vercel.com).
2. Set the **Root Directory** to `watch-party-client`.
3. Framework Preset: **Next.js**.
4. Add the Environment Variable:
   - `NEXT_PUBLIC_SOCKET_URL`: The live URL of your deployed Render backend (e.g., `https://your-server.onrender.com`).
5. Deploy.

---

## 💡 Technical Decisions & Trade-Offs

- **Server-Authoritative Timing vs Client Clocks**:
  Instead of continually pinging current seconds over WebSockets, the server records the `playbackTime`, `playState`, and `lastUpdated` timestamp. Any client connecting calculates `elapsed = (Date.now() - lastUpdated) / 1000`. This reduces network overhead by over 90% while maintaining sub-second synchronization.

- **Threshold-Based Seeking**:
  Direct continuous seeking causes YouTube video stuttering. We implement a 1.5-second drift threshold: adjustments only occur if the participant's video drifts by more than 1.5 seconds from the server's authoritative timestamp.

- **OOP State Encapsulation**:
  Rather than managing ad-hoc dictionaries in socket callbacks, logic is partitioned into `Participant`, `Room`, and `RoomManager` classes. This ensures role permissions, time drift formulas, and participant maps are self-contained and testable.
