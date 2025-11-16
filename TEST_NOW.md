# Quick Test Guide - Persistent Floating Window

## 🚀 Test in 2 Minutes

### Step 1: Start the App
```bash
npm run dev
```

### Step 2: Join a Meeting
1. Open http://localhost:3000
2. Create or join a meeting
3. Allow camera/microphone permissions

### Step 3: Test Persistence (THE KEY TEST!)
```
1. Enable floating window (toggle button in top-right)
2. Switch to another browser tab
   → ✅ Popup window should appear with your video

3. Return to the meeting tab
   → ✅ Popup should STAY OPEN (this is the fix!)

4. Switch to another tab again
   → ✅ Popup should STILL be open

5. Return to meeting tab again
   → ✅ Popup should STILL be open

6. Click the X button in the popup
   → ✅ Popup should close
```

## ✅ Success Criteria

If all these work, the fix is successful:

1. ✅ Popup opens when you switch tabs
2. ✅ Popup STAYS OPEN when you return to meeting tab
3. ✅ Popup persists across multiple tab switches
4. ✅ Popup only closes when you click X or disable feature

## ❌ If Something's Wrong

### Popup doesn't open
- Check if popups are blocked in browser
- Allow popups for localhost
- Check browser console for errors

### Popup closes when returning to tab
- This means the fix didn't work
- Check the code changes were applied
- Rebuild: `npm run build`

### Popup opens multiple times
- Close all popups
- Refresh the page
- Try again

## 🎯 The Main Test

**This is what we fixed**:

```
OLD BEHAVIOR (BROKEN):
Tab A (Meeting) → Tab B → Popup opens
Tab B → Tab A (Meeting) → Popup CLOSES ❌

NEW BEHAVIOR (FIXED):
Tab A (Meeting) → Tab B → Popup opens
Tab B → Tab A (Meeting) → Popup STAYS OPEN ✅
Tab A → Tab C → Popup STILL OPEN ✅
Tab C → Tab A → Popup STILL OPEN ✅
```

## 📝 Quick Checklist

- [ ] Popup opens on tab switch
- [ ] Popup stays open when returning to meeting tab
- [ ] Popup persists across multiple tab switches
- [ ] Popup closes when clicking X button
- [ ] No console errors
- [ ] Video plays smoothly in popup

## 🎉 If All Tests Pass

**Congratulations!** The fix is working correctly. The floating window now:
- Opens in a separate browser window
- Stays visible when switching tabs
- Persists until you explicitly close it
- Works exactly as expected

## 📚 More Info

- `FINAL_FIX_SUMMARY.md` - Complete overview
- `PERSISTENT_FLOATING_WINDOW_FIX.md` - Technical details

---

**Ready to deploy!** 🚀
