# Environment Variables Setup Guide

## 📋 Quick Reference

### Local Development (.env.local)
```env
# Leave empty - auto-detects localhost:3000
NEXT_PUBLIC_SOCKET_URL=
```

### Production on Render

#### Option 1: Auto-detect (Recommended for most cases)
```env
# Leave empty - will use window.location.origin
NEXT_PUBLIC_SOCKET_URL=
```

#### Option 2: Explicit URL (Recommended for custom domains)
```env
# Set to your Render URL
NEXT_PUBLIC_SOCKET_URL=https://luma-meet-abc123.onrender.com
```

## 🔍 How It Works

The app uses this logic in `app/room/[id]/page.tsx`:

```typescript
const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin;
```

- **If set:** Uses the specified URL
- **If empty:** Uses the current page's origin (auto-detect)

## 🎯 When to Set It

### ✅ You SHOULD set it if:
- Using a custom domain
- Having Socket.io connection issues
- Deploying behind a proxy/CDN
- Need explicit control over WebSocket endpoint

### ⚠️ You DON'T need to set it if:
- Using default Render URL
- Testing locally
- Everything works without it (auto-detect works)

## 📝 Step-by-Step for Render

### After First Deployment:

1. **Get your Render URL:**
   - Go to your Render dashboard
   - Copy the URL (e.g., `https://luma-meet-abc123.onrender.com`)

2. **Set the environment variable:**
   - Click on your service
   - Go to "Environment" tab
   - Click "Add Environment Variable"
   - Key: `NEXT_PUBLIC_SOCKET_URL`
   - Value: `https://luma-meet-abc123.onrender.com`
   - Click "Save Changes"

3. **Redeploy (if needed):**
   - Render will auto-redeploy
   - Or manually trigger: "Manual Deploy" → "Deploy latest commit"

4. **Test:**
   - Open your app
   - Check browser console for Socket.io connection
   - Should see: "Socket connected" or similar

## 🐛 Troubleshooting

### Socket.io not connecting?

**Check 1:** Browser console
```
Look for: "Socket connection error" or "WebSocket failed"
```

**Check 2:** Network tab
```
Look for WebSocket connection to your domain
Should see: ws://your-domain.com or wss://your-domain.com
```

**Fix:** Set `NEXT_PUBLIC_SOCKET_URL` explicitly

### Mixed content errors?

**Problem:** HTTP page trying to connect to HTTPS socket

**Fix:** Ensure both use HTTPS:
```env
NEXT_PUBLIC_SOCKET_URL=https://your-domain.com
```

### CORS errors?

**Problem:** Socket.io blocked by CORS

**Fix:** Update `server.js`:
```javascript
cors: {
  origin: 'https://your-domain.com',
  methods: ['GET', 'POST'],
}
```

## 🔒 Security Notes

- Always use HTTPS in production (`https://`)
- Never use HTTP in production (`http://`)
- WebRTC requires HTTPS to work
- Socket.io will upgrade to WSS (secure WebSocket) automatically

## 📱 Testing

### Local Testing:
```bash
npm run dev
# Opens at http://localhost:3000
# Socket.io connects to http://localhost:3000
```

### Production Testing:
```bash
# Open your Render URL
https://luma-meet-abc123.onrender.com

# Socket.io should connect to:
wss://luma-meet-abc123.onrender.com
```

## ✨ Best Practice

**For most users:** Leave `NEXT_PUBLIC_SOCKET_URL` empty and let it auto-detect. Only set it explicitly if you encounter connection issues or use a custom domain.

---

**Still having issues?** Check the browser console and Render logs for specific error messages.
