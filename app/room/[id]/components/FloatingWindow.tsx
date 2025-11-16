import { useEffect, useRef } from 'react';

interface FloatingWindowProps {
  stream: MediaStream | null;
  userName: string;
  isVisible: boolean;
  onClose?: () => void;
}

export function FloatingWindow({ stream, userName, isVisible, onClose }: FloatingWindowProps) {
  const popupWindowRef = useRef<Window | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only proceed if visible and we have a stream
    if (!isVisible || !stream || typeof window === 'undefined') {
      return;
    }

    // Store stream reference
    streamRef.current = stream;

    // Check if popup is already open
    if (popupWindowRef.current && !popupWindowRef.current.closed) {
      // Update existing popup with new stream
      updatePopupStream(popupWindowRef.current, stream, userName);
      return;
    }

    // Open new popup window
    const width = 320;
    const height = 280;
    const left = window.screen.width - width - 20;
    const top = 80;

    const popup = window.open(
      '',
      'FloatingVideoWindow',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no,status=no,menubar=no,toolbar=no,location=no`
    );

    if (!popup) {
      console.error('Failed to open popup window. Please allow popups for this site.');
      onClose?.();
      return;
    }

    popupWindowRef.current = popup;

    // Set up the popup window content
    setupPopupWindow(popup, stream, userName, onClose);

    // Monitor if popup is closed by user
    checkIntervalRef.current = setInterval(() => {
      if (popup.closed) {
        cleanup();
        onClose?.();
      }
    }, 500);

    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, stream, userName]);

  // Only cleanup when component unmounts (not when isVisible changes)
  // This allows the popup to stay open even when returning to the main tab
  useEffect(() => {
    return () => {
      // Cleanup only on unmount
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      if (popupWindowRef.current && !popupWindowRef.current.closed) {
        popupWindowRef.current.close();
        popupWindowRef.current = null;
      }
    };
  }, []);

  const cleanup = () => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    if (popupWindowRef.current && !popupWindowRef.current.closed) {
      popupWindowRef.current.close();
      popupWindowRef.current = null;
    }
  };

  const setupPopupWindow = (
    popup: Window,
    stream: MediaStream,
    userName: string,
    onClose?: () => void
  ) => {
    const doc = popup.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Video - ${userName}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              background: #1a1a1a;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              overflow: hidden;
              display: flex;
              flex-direction: column;
              height: 100vh;
            }
            .header {
              background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
              padding: 8px 12px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              z-index: 10;
            }
            .title {
              color: white;
              font-size: 12px;
              font-weight: 600;
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .close-btn {
              background: rgba(0,0,0,0.5);
              border: none;
              color: white;
              width: 24px;
              height: 24px;
              border-radius: 50%;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all 0.2s;
            }
            .close-btn:hover {
              background: rgba(239,68,68,0.8);
              transform: scale(1.1);
            }
            .video-container {
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #000;
            }
            video {
              width: 100%;
              height: 100%;
              object-fit: contain;
            }
            .footer {
              background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
              padding: 8px;
              text-align: center;
              position: absolute;
              bottom: 0;
              left: 0;
              right: 0;
            }
            .footer-text {
              color: rgba(255,255,255,0.7);
              font-size: 10px;
            }
            .status {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              color: white;
              text-align: center;
              z-index: 5;
            }
            .spinner {
              border: 3px solid rgba(255,255,255,0.3);
              border-top: 3px solid white;
              border-radius: 50%;
              width: 40px;
              height: 40px;
              animation: spin 1s linear infinite;
              margin: 0 auto 10px;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">
              <span>📹</span>
              <span id="userName">${userName}</span>
            </div>
            <button class="close-btn" onclick="window.close()" title="Close window">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="video-container">
            <div class="status" id="status">
              <div class="spinner"></div>
              <div>Connecting...</div>
            </div>
            <video id="video" autoplay muted playsinline></video>
          </div>
          <div class="footer">
            <div class="footer-text">Always on top • Drag to move</div>
          </div>
          <script>
            // Keep window always on top (best effort)
            window.focus();
            setInterval(() => {
              if (!document.hidden) {
                window.focus();
              }
            }, 1000);

            // Handle video stream
            const video = document.getElementById('video');
            const status = document.getElementById('status');
            
            window.addEventListener('message', (event) => {
              if (event.data.type === 'UPDATE_STREAM') {
                // Stream will be set from parent
                status.style.display = 'none';
              } else if (event.data.type === 'UPDATE_NAME') {
                document.getElementById('userName').textContent = event.data.userName;
                document.title = 'Video - ' + event.data.userName;
              }
            });

            // Notify parent when window is ready
            if (window.opener) {
              window.opener.postMessage({ type: 'POPUP_READY' }, '*');
            }
          </script>
        </body>
      </html>
    `);
    doc.close();

    // Wait for popup to be ready, then set the stream
    setTimeout(() => {
      updatePopupStream(popup, stream, userName);
    }, 100);
  };

  const updatePopupStream = (popup: Window, stream: MediaStream, userName: string) => {
    try {
      const video = popup.document.getElementById('video') as HTMLVideoElement;
      const status = popup.document.getElementById('status') as HTMLElement;
      
      if (video && stream) {
        video.srcObject = stream;
        video.play().then(() => {
          if (status) status.style.display = 'none';
        }).catch((err) => {
          console.error('Error playing video in popup:', err);
        });
      }

      // Update name
      popup.postMessage({ type: 'UPDATE_NAME', userName }, '*');
    } catch (err) {
      console.error('Error updating popup stream:', err);
    }
  };

  // This component doesn't render anything in the main window
  return null;
}
