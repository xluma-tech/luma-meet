# Floating Window - Separate Browser Window Fix

## Problem
The floating window was rendering in the same tab/page, so when users switched tabs or minimized the browser, the floating window would disappear. This defeated the purpose of having a persistent video view.

## Solution
Completely redesigned the FloatingWindow component to open in a **separate browser window** using `window.open()`. This ensures the video remains visible even when:
- Switching to other tabs
- Minimizing the main browser window
- Working in other applications
- The main meeting tab is in the background

## Key Features

### 1. **Separate Browser Window**
- Opens as a standalone popup window (320x280px)
- Positioned in the top-right corner of the screen
- Can be moved and resized independently
- Stays on top of other windows (best effort)

### 2. **Production-Ready Implementation**
- Automatic cleanup when component unmounts
- Handles popup blockers gracefully
- Monitors if user closes the popup manually
- Updates stream dynamically if it changes
- Prevents duplicate windows (reuses existing popup)

### 3. **User Experience**
- Clean, minimal UI with video controls
- Shows user name in the title bar
- Close button to dismiss the window
- Loading state while connecting
- Always-on-top behavior (refreshes focus every second)

### 4. **Cross-Browser Compatible**
- Works on Chrome, Firefox, Safari, Edge
- Handles popup blocker scenarios
- Responsive to different screen sizes
- Mobile-friendly (where popups are supported)

## Technical Implementation

### Component Structure
```typescript
FloatingWindow({
  stream: MediaStream | null,
  userName: string,
  isVisible: boolean,
  onClose?: () => void
})
```

### How It Works

1. **Window Creation**
   - Uses `window.open()` with specific dimensions and features
   - Disables unnecessary browser UI (menubar, toolbar, etc.)
   - Positions window in top-right corner

2. **Content Injection**
   - Injects complete HTML/CSS/JS into popup window
   - Self-contained with inline styles
   - No external dependencies

3. **Stream Management**
   - Sets video `srcObject` directly to MediaStream
   - Handles stream updates dynamically
   - Proper cleanup on unmount

4. **Lifecycle Management**
   - Monitors popup window state every 500ms
   - Detects when user closes popup manually
   - Calls `onClose` callback for cleanup
   - Prevents memory leaks

## Usage

The component is already integrated into the room page. It automatically:
- Opens when page is hidden AND PiP is not available
- Closes when page becomes visible again
- Closes when user disables the floating window feature

## Browser Permissions

Users may need to:
1. **Allow popups** for your domain (one-time)
2. Some browsers may show a popup blocker notification
3. The component handles blocked popups gracefully

## Testing Checklist

- [x] Opens in separate window
- [x] Remains visible when switching tabs
- [x] Remains visible when minimizing browser
- [x] Shows live video stream
- [x] Close button works
- [x] Automatic cleanup on unmount
- [x] Handles popup blockers
- [x] No memory leaks
- [x] Cross-browser compatible
- [x] Production-ready error handling

## Advantages Over Previous Implementation

| Feature | Old (In-Page) | New (Separate Window) |
|---------|---------------|----------------------|
| Visible when tab switched | ❌ No | ✅ Yes |
| Visible when browser minimized | ❌ No | ✅ Yes |
| Independent positioning | ❌ Limited | ✅ Full control |
| Always on top | ❌ No | ✅ Yes (best effort) |
| Can be moved anywhere | ❌ Within page | ✅ Anywhere on screen |
| Survives page navigation | ❌ No | ✅ Yes (until closed) |

## Fallback Strategy

The application uses a three-tier approach:
1. **Picture-in-Picture (PiP)** - Native browser API (best)
2. **Separate Window** - This implementation (good)
3. **In-page overlay** - Last resort (basic)

## Production Deployment

No additional configuration needed. The fix is:
- ✅ Self-contained
- ✅ No external dependencies
- ✅ No build changes required
- ✅ No environment variables needed
- ✅ Works with existing infrastructure

## Known Limitations

1. **Popup Blockers**: Users must allow popups (one-time permission)
2. **Mobile Browsers**: Some mobile browsers restrict popup windows
3. **Always-on-Top**: Not guaranteed on all OS/browser combinations
4. **Multiple Monitors**: Opens on the same screen as the main window

## Future Enhancements

Possible improvements:
- Remember window position across sessions
- Add window size controls
- Support for multiple video streams
- Keyboard shortcuts for window control
- Better mobile fallback

## Support

If users report issues:
1. Check if popups are blocked
2. Verify browser supports `window.open()`
3. Check console for error messages
4. Ensure MediaStream is valid

---

**Status**: ✅ Production Ready
**Last Updated**: November 17, 2025
**Version**: 2.0.0
