const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Store rooms and their participants
  const rooms = new Map();

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', ({ roomId, userName }) => {
      try {
        socket.join(roomId);
        socket.userName = userName;
        socket.roomId = roomId;

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }
        rooms.get(roomId).add(socket.id);

        // Notify others in the room
        socket.to(roomId).emit('user-joined', {
          userId: socket.id,
          userName: userName,
        });

        // Send list of existing users to the new user
        const existingUsers = Array.from(rooms.get(roomId))
          .filter((id) => id !== socket.id)
          .map((id) => {
            const userSocket = io.sockets.sockets.get(id);
            return {
              userId: id,
              userName: userSocket?.userName || 'Unknown',
            };
          });

        socket.emit('existing-users', existingUsers);

        console.log(`${userName} (${socket.id}) joined room ${roomId}. Total: ${rooms.get(roomId).size}`);
      } catch (err) {
        console.error('Error joining room:', err);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    socket.on('signal', ({ to, signal }) => {
      try {
        io.to(to).emit('signal', {
          from: socket.id,
          signal: signal,
        });
      } catch (err) {
        console.error('Error sending signal:', err);
      }
    });

    socket.on('screen-signal', ({ to, signal }) => {
      try {
        io.to(to).emit('screen-signal', {
          from: socket.id,
          signal: signal,
        });
      } catch (err) {
        console.error('Error sending screen signal:', err);
      }
    });

    socket.on('chat-message', ({ roomId, userName, message, timestamp }) => {
      try {
        socket.to(roomId).emit('chat-message', {
          userId: socket.id,
          userName,
          message,
          timestamp,
        });
      } catch (err) {
        console.error('Error sending chat message:', err);
      }
    });

    socket.on('private-message', ({ roomId, userName, message, timestamp, to }) => {
      try {
        io.to(to).emit('private-message', {
          userId: socket.id,
          userName,
          message,
          timestamp,
        });
      } catch (err) {
        console.error('Error sending private message:', err);
      }
    });

    socket.on('screen-share-started', ({ roomId }) => {
      try {
        socket.to(roomId).emit('screen-share-started', {
          userId: socket.id,
        });
      } catch (err) {
        console.error('Error broadcasting screen share start:', err);
      }
    });

    socket.on('screen-share-stopped', ({ roomId }) => {
      try {
        socket.to(roomId).emit('screen-share-stopped', {
          userId: socket.id,
        });
      } catch (err) {
        console.error('Error broadcasting screen share stop:', err);
      }
    });

    socket.on('disconnect', () => {
      try {
        if (socket.roomId) {
          const room = rooms.get(socket.roomId);
          if (room) {
            room.delete(socket.id);
            if (room.size === 0) {
              rooms.delete(socket.roomId);
              console.log(`Room ${socket.roomId} deleted (empty)`);
            }
          }

          socket.to(socket.roomId).emit('user-left', {
            userId: socket.id,
          });

          console.log(`${socket.userName} (${socket.id}) left room ${socket.roomId}`);
        }
      } catch (err) {
        console.error('Error handling disconnect:', err);
      }
    });

    socket.on('error', (err) => {
      console.error('Socket error:', err);
    });
  });

  httpServer
    .once('error', (err) => {
      console.error('Server error:', err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Environment: ${dev ? 'development' : 'production'}`);
    });
});
