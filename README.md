# Luma Meet - Video Conferencing App

A modern, real-time video conferencing application built with Next.js, Socket.io, and WebRTC.

## Features

- 🎥 **HD Video Calls** - High-quality video with adaptive quality
- 🎤 **Crystal Clear Audio** - Echo cancellation and noise suppression
- 🖥️ **Screen Sharing** - Share your screen with system audio on all platforms
- 🔊 **System Audio Capture** - Share video/audio from your screen
- 💬 **Real-time Chat** - Public and private messaging
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile
- 🔒 **Secure** - Peer-to-peer WebRTC connections
- ⚡ **Fast** - Optimized for performance

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm 9+

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Create Event**: Click "Create New Event" to start a new meeting
2. **Share Code**: Copy the event code and share with participants
3. **Join Event**: Enter the event code to join an existing meeting
4. **Controls**:
   - 🎤 Mute/Unmute microphone
   - 📹 Turn camera on/off
   - 🖥️ Share screen (desktop only)
   - 💬 Open chat
   - 🚪 Leave meeting

## Tech Stack

- **Frontend**: Next.js 16, React 19, TailwindCSS 4
- **Backend**: Node.js, Socket.io
- **WebRTC**: SimplePeer
- **Real-time**: Socket.io for signaling

## Project Structure

```
luma-meet/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Home page
│   ├── create/            # Create event page
│   ├── event/[id]/        # Event lobby
│   ├── room/[id]/         # Video call room
│   └── api/               # API routes
├── data/                  # JSON data storage
├── public/                # Static assets
├── server.js              # Custom server with Socket.io
└── package.json           # Dependencies
```

## Environment Variables

Create a `.env.local` file:

```env
# Socket.io URL (leave empty for local development)
NEXT_PUBLIC_SOCKET_URL=

# For production, set to your deployed URL:
# NEXT_PUBLIC_SOCKET_URL=https://your-app.onrender.com
```

## Deployment

### Deploy to Render

1. Push code to GitHub
2. Connect repository to Render
3. Set environment variables:
   - `NODE_ENV=production`
   - `NEXT_PUBLIC_SOCKET_URL=https://your-app.onrender.com`
4. Deploy!

Build command: `npm install && npm run build`
Start command: `npm start`

## Browser Support

- ✅ Chrome/Edge (Desktop) - Full support
- ✅ Firefox (Desktop) - Full support
- ✅ Safari (Desktop) - Full support
- ✅ Chrome/Edge (Android) - Full support including screen share
- ✅ Safari (iOS 15.4+) - Full support including screen share
- ✅ Firefox (Android) - Full support including screen share

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Troubleshooting

### Camera/Microphone not working
- Allow permissions when prompted
- Check browser settings
- Close other apps using camera

### Screen share not working
- Allow screen share permission when prompted
- For audio: Check "Share audio" or "Share tab audio" in browser dialog
- iOS: Requires iOS 15.4+ and Safari
- Android: Use Chrome, Edge, or Firefox
- Desktop: All major browsers supported
- Update to latest browser version if not working

### No audio from shared screen
- Chrome/Edge: Check "Share audio" checkbox in screen share dialog
- Firefox: Check "Share system audio" option
- Safari: System audio is automatically included
- Make sure the video/audio is playing on the shared screen

### Connection issues
- Check network/firewall
- Ensure WebRTC is not blocked
- Try refreshing the page

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.

---

Built with ❤️ using Next.js and WebRTC
