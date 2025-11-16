# Mobile Video Grid - Testing Guide

## Quick Test Instructions

### 1. Start the Application
```bash
npm run dev
# or for production
npm run build && npm start
```

### 2. Test on Mobile Device

#### Option A: Using Real Mobile Device
1. Find your local IP address:
   ```bash
   # Linux/Mac
   ifconfig | grep "inet "
   # or
   ip addr show
   ```

2. Access from mobile browser:
   ```
   http://YOUR_IP:3000
   ```

3. Create or join a room with multiple participants

#### Option B: Using Browser DevTools
1. Open Chrome DevTools (F12)
2. Click "Toggle Device Toolbar" (Ctrl+Shift+M)
3. Select a mobile device (e.g., iPhone 12 Pro)
4. Refresh the page

### 3. What to Look For

#### ✅ Grid Layout (Mobile)
- [ ] Videos appear in **2 columns**
- [ ] Each tile is **square shaped** (1:1 aspect ratio)
- [ ] Consistent spacing between tiles (8px)
- [ ] Tiles fill the width properly

#### ✅ Active Speaker Detection
- [ ] Blue **glowing ring** appears around speaking participant
- [ ] Glow is **4px thick** and blue (#3B82F6)
- [ ] Glow has **animated shadow** effect
- [ ] Transitions are **smooth** (300ms)

#### ✅ Speaker Positioning
- [ ] Active speaker moves to **top-left position**
- [ ] Local video (You) can be active speaker
- [ ] Remote participants can be active speaker
- [ ] Position updates smoothly

#### ✅ Screen Sharing Mode
- [ ] Screen share shows in **rectangle at top**
- [ ] Participant tiles below in **2-column square grid**
- [ ] Active speaker glow **still works**
- [ ] Layout is responsive

### 4. Test Scenarios

#### Scenario 1: Two Participants
1. Join room with 2 people
2. Speak into microphone
3. **Expected**: Your tile gets blue glow
4. Other person speaks
5. **Expected**: Their tile gets blue glow and moves to top

#### Scenario 2: Multiple Participants (4+)
1. Join room with 4+ people
2. Different people speak
3. **Expected**: 
   - Active speaker always at top-left
   - 2 columns maintained on mobile
   - Smooth transitions between speakers

#### Scenario 3: Screen Sharing
1. Start screen sharing
2. Speak while sharing
3. **Expected**:
   - Screen share at top (rectangle)
   - Your tile below with glow
   - 2-column grid maintained

#### Scenario 4: No Audio
1. Mute all participants
2. **Expected**:
   - No glow appears
   - Grid maintains 2-column layout
   - No errors in console

### 5. Browser Testing Matrix

| Browser | Mobile | Desktop | Status |
|---------|--------|---------|--------|
| Chrome | ✅ | ✅ | Fully Supported |
| Safari iOS | ✅ | ✅ | Fully Supported |
| Firefox | ✅ | ✅ | Fully Supported |
| Edge | ✅ | ✅ | Fully Supported |
| Samsung Internet | ✅ | N/A | Should Work |

### 6. Performance Checks

#### CPU Usage
- Open DevTools → Performance tab
- Record for 10 seconds while someone speaks
- **Expected**: CPU usage < 30%

#### Memory Usage
- Open DevTools → Memory tab
- Take heap snapshot
- Speak for 1 minute
- Take another snapshot
- **Expected**: No significant memory increase

#### Network
- Open DevTools → Network tab
- **Expected**: No excessive requests
- WebRTC connections stable

### 7. Common Issues & Solutions

#### Issue: No Glow Appears
**Solution**: 
- Check browser console for errors
- Verify microphone permissions granted
- Ensure audio is not muted
- Check Web Audio API support

#### Issue: Grid Not 2 Columns
**Solution**:
- Verify viewport width < 768px
- Check CSS classes applied
- Clear browser cache
- Inspect element to verify classes

#### Issue: Tiles Not Square
**Solution**:
- Verify `aspect-square` class applied
- Check for CSS conflicts
- Test in different browser

#### Issue: Laggy Transitions
**Solution**:
- Check CPU usage
- Reduce number of participants
- Disable browser extensions
- Test on different device

### 8. Debug Mode

Enable detailed logging:
```javascript
// In browser console
localStorage.setItem('debug', 'true');
// Reload page
```

Check logs:
- Audio analyser setup messages
- Active speaker changes
- Stream connections
- Performance metrics

### 9. Accessibility Testing

#### Screen Reader
- [ ] Video tiles have proper labels
- [ ] Active speaker announced
- [ ] Controls are keyboard accessible

#### Keyboard Navigation
- [ ] Tab through controls
- [ ] Space/Enter to activate buttons
- [ ] Escape to close chat

#### High Contrast
- [ ] Glow visible in high contrast mode
- [ ] Text readable
- [ ] Icons clear

### 10. Production Checklist

Before deploying:
- [ ] Test on real iOS device
- [ ] Test on real Android device
- [ ] Test with poor network (3G simulation)
- [ ] Test with 8+ participants
- [ ] Verify no console errors
- [ ] Check error tracking setup
- [ ] Monitor performance metrics
- [ ] Test screen rotation (portrait/landscape)

## Quick Visual Reference

### Expected Mobile Layout
```
┌─────────┬─────────┐
│ Active  │ User 2  │  ← 2 columns
│ Speaker │         │
│ (Glow)  │         │
├─────────┼─────────┤
│ User 3  │ User 4  │
│         │         │
│         │         │
└─────────┴─────────┘
```

### Expected Glow Effect
```
┌─────────────────┐
│ ╔═══════════╗   │  ← Blue ring (4px)
│ ║   Video   ║   │
│ ║   Tile    ║   │  ← Shadow glow
│ ╚═══════════╝   │
└─────────────────┘
```

## Support Commands

### View Logs
```bash
# Development
npm run dev

# Production
npm run build && npm start

# Check for errors
tail -f logs/error.log
```

### Clear Cache
```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build
```

---

**Need Help?**
- Check browser console for errors
- Review MOBILE_VIDEO_GRID_IMPLEMENTATION.md
- Test in incognito mode
- Try different browser
