# Testing the Floating Window Feature

## Quick Test Guide

### Prerequisites
1. Start your development server: `npm run dev`
2. Open the application in your browser
3. Join or create a meeting room

### Test Scenarios

#### ✅ Test 1: Basic Functionality
1. Join a video meeting
2. Enable the floating window feature (button in top-right)
3. Switch to another tab
4. **Expected**: A separate popup window should appear with your video
5. **Verify**: Video is playing in the popup window

#### ✅ Test 2: Tab Switching
1. With floating window enabled, switch between multiple tabs
2. **Expected**: Popup window remains visible and on top
3. **Verify**: Video continues playing smoothly

#### ✅ Test 3: Browser Minimize
1. With floating window enabled, minimize your browser
2. **Expected**: Popup window remains visible on your desktop
3. **Verify**: You can still see your video while browser is minimized

#### ✅ Test 4: Window Controls
1. Click the close button (X) in the popup window
2. **Expected**: Popup closes and floating window feature is disabled
3. **Verify**: No memory leaks or errors in console

#### ✅ Test 5: Popup Blocker
1. If popup is blocked, check browser notification bar
2. Click "Allow popups" for this site
3. Try enabling floating window again
4. **Expected**: Popup opens successfully after permission granted

#### ✅ Test 6: Return to Main Tab
1. With popup open, return to the main meeting tab
2. **Expected**: Popup automatically closes
3. **Verify**: No duplicate windows or errors

#### ✅ Test 7: Disable Feature
1. Click the floating window toggle button to disable
2. **Expected**: Popup closes immediately
3. **Verify**: Clean shutdown with no errors

### Browser-Specific Tests

#### Chrome/Edge
- Popup should open without issues
- Always-on-top behavior works well
- No permission prompts after first allow

#### Firefox
- May show popup blocker on first attempt
- After allowing, works smoothly
- Popup stays on top

#### Safari
- May require popup permission
- Works on macOS Safari 15.4+
- iOS Safari has limited popup support

### Common Issues & Solutions

#### Issue: Popup doesn't open
**Solution**: 
- Check if popups are blocked (browser notification bar)
- Allow popups for your domain
- Refresh the page and try again

#### Issue: Popup closes immediately
**Solution**:
- Check browser console for errors
- Verify MediaStream is active
- Ensure camera permissions are granted

#### Issue: Video not playing in popup
**Solution**:
- Check if camera is being used by another app
- Verify browser has camera permissions
- Try refreshing the meeting

#### Issue: Popup appears behind other windows
**Solution**:
- This is browser/OS dependent
- The popup tries to stay on top but isn't guaranteed
- Manually bring popup to front if needed

### Developer Testing

#### Console Checks
Open browser console and verify:
```javascript
// No errors related to:
- "Failed to open popup window"
- "Error updating popup stream"
- "Error playing video in popup"

// Should see:
- Clean component mounting/unmounting
- Proper stream handling
- No memory leaks
```

#### Performance Checks
1. Open Chrome DevTools → Performance
2. Record while enabling/disabling floating window
3. **Verify**: No memory leaks or performance issues

#### Network Checks
1. Open DevTools → Network
2. Enable floating window
3. **Verify**: No unnecessary network requests

### Production Checklist

Before deploying:
- [ ] Test on Chrome, Firefox, Safari, Edge
- [ ] Test popup blocker scenarios
- [ ] Test with slow network
- [ ] Test with multiple participants
- [ ] Test window close/reopen cycles
- [ ] Verify no console errors
- [ ] Check memory usage over time
- [ ] Test on different screen sizes
- [ ] Verify mobile fallback (if applicable)
- [ ] Test with screen sharing active

### Success Criteria

The feature is working correctly if:
1. ✅ Popup opens in separate window
2. ✅ Video plays smoothly in popup
3. ✅ Popup remains visible when switching tabs
4. ✅ Popup remains visible when minimizing browser
5. ✅ Close button works properly
6. ✅ No console errors
7. ✅ No memory leaks
8. ✅ Graceful handling of popup blockers
9. ✅ Clean cleanup on component unmount
10. ✅ Works across major browsers

### Reporting Issues

If you find issues, please report:
1. Browser name and version
2. Operating system
3. Steps to reproduce
4. Console error messages
5. Expected vs actual behavior
6. Screenshots if applicable

---

**Happy Testing! 🚀**
