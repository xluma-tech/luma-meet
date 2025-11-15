# Deployment Guide for Render

## Prerequisites
- GitHub account
- Render account (free tier works)

## Step 1: Push to GitHub

1. Initialize git repository (if not already done):
```bash
git init
git add .
git commit -m "Initial commit"
```

2. Create a new repository on GitHub

3. Push your code:
```bash
git remote add origin https://github.com/YOUR_USERNAME/luma-meet.git
git branch -M main
git push -u origin main
```

## Step 2: Deploy on Render

### Option A: Using render.yaml (Recommended)

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" → "Blueprint"
3. Connect your GitHub repository
4. Render will automatically detect `render.yaml` and configure everything
5. Click "Apply" to deploy

### Option B: Manual Setup

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: luma-meet
   - **Environment**: Node
   - **Region**: Choose closest to your users
   - **Branch**: main
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free

5. Add Environment Variables:
   - `NODE_ENV` = `production`
   - `PORT` = `10000` (Render default)
   - `HOSTNAME` = `0.0.0.0`
   - `NEXT_PUBLIC_SOCKET_URL` = Leave empty initially (will set after deploy)

6. Click "Create Web Service"

## Step 3: Post-Deployment

1. Wait for the build to complete (5-10 minutes)
2. Your app will be available at: `https://luma-meet-XXXX.onrender.com`
3. **(Optional but Recommended)** Set the Socket URL:
   - Go to your service settings
   - Add environment variable: `NEXT_PUBLIC_SOCKET_URL` = `https://luma-meet-XXXX.onrender.com`
   - This ensures Socket.io connects to the correct URL
   - If not set, it will auto-detect from the browser (works in most cases)
4. Test by creating an event and joining with multiple browser tabs

## Important Notes

### Free Tier Limitations
- Service spins down after 15 minutes of inactivity
- First request after spin-down takes 30-60 seconds
- 750 hours/month free (enough for testing)

### WebRTC Considerations
- Works great for 2-4 participants
- For 5+ participants, consider upgrading to paid tier for better performance
- STUN servers are free (Google's public STUN)
- For production with many users, consider adding TURN servers

### Troubleshooting

**Build fails:**
- Check Node version in package.json
- Ensure all dependencies are in package.json

**Socket.io connection fails:**
- Make sure WebSocket is enabled (it is by default on Render)
- Check browser console for errors

**Video not working:**
- Ensure HTTPS is enabled (Render provides this automatically)
- Check browser permissions for camera/microphone

**Slow performance:**
- Free tier has limited resources
- Consider upgrading to paid tier ($7/month)

## Upgrading to Production

For production use with many users:

1. **Upgrade Render Plan**: $7/month for better performance
2. **Add TURN Server**: For users behind strict firewalls
   - Use services like Twilio TURN or Xirsys
   - Add to WebRTC config in room page
3. **Add Database**: Replace JSON file storage with PostgreSQL
4. **Add Authentication**: Implement user accounts
5. **Add Analytics**: Track usage and errors
6. **Custom Domain**: Add your own domain in Render settings

## Monitoring

- View logs in Render dashboard
- Monitor active connections
- Check for errors in real-time

## Scaling

For 10+ concurrent users:
- Upgrade to Starter plan ($7/month)
- Consider implementing SFU (Selective Forwarding Unit) for better bandwidth usage
- Add Redis for session management across multiple instances

## Support

If you encounter issues:
1. Check Render logs
2. Check browser console
3. Verify environment variables
4. Test locally first with `npm run dev`
