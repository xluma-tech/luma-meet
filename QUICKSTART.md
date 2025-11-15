# Quick Start Guide

## 🚀 Get Running in 5 Minutes

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm run dev
```

### 3. Open Your Browser
Go to: http://localhost:3000

### 4. Test the App

**Create an Event:**
1. Click "Create New Event"
2. Fill in the details
3. Click "Create Event"
4. Copy the event code (e.g., `abc123xyz`)

**Join the Meeting:**
1. Open a new browser tab (or use a different browser)
2. Go to http://localhost:3000
3. Click "Join Existing Event"
4. Enter the event code
5. Enter your name
6. Click "Join Now"

**Test with Multiple Users:**
- Open 3-4 browser tabs
- Join the same event code from each tab
- You should see all video feeds
- Test mute, video off, and screen sharing

## 🎯 Common Issues

### Port Already in Use
```bash
# Kill the process on port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:3000 | xargs kill -9
```

### Camera Not Working
- Allow camera/microphone permissions in browser
- Check if another app is using the camera
- Try a different browser

### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
npm run dev
```

## 📦 Deploy to Render

1. **Push to GitHub:**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/luma-meet.git
git push -u origin main
```

2. **Deploy on Render:**
- Go to https://dashboard.render.com/
- Click "New" → "Blueprint"
- Connect your GitHub repo
- Click "Apply"
- Wait 5-10 minutes
- Done! 🎉

## 🔧 Environment Variables (Production)

Render sets these automatically, but you can customize:

- `NODE_ENV` = `production`
- `PORT` = `10000`
- `HOSTNAME` = `0.0.0.0`
- `CORS_ORIGIN` = `*` (or your domain)

## 📱 Testing on Mobile

1. Find your local IP:
   ```bash
   # Windows:
   ipconfig
   
   # Mac/Linux:
   ifconfig
   ```

2. Update server.js hostname to `0.0.0.0`

3. Access from mobile: `http://YOUR_IP:3000`

## 🎉 You're Ready!

Your video meeting app is now running. Share the event codes with friends to test!

For production deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md)
