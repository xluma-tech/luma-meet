import { useEffect, useRef, useState } from 'react';

interface Participant {
  id: string;
  stream: MediaStream;
  userName: string;
  isScreenShare: boolean;
}

interface FloatingWindowProps {
  participants: Participant[];
  isVisible: boolean;
  onClose?: () => void;
}

export function FloatingWindow({ participants, isVisible, onClose }: FloatingWindowProps) {
  const popupWindowRef = useRef<Window | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const participantsRef = useRef<Participant[]>([]);
  const isPopupOpenRef = useRef(false);
  const [isMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  });

  // Effect to open/close popup based on visibility (Desktop only)
  useEffect(() => {
    if (isMobile) return; // Skip popup for mobile

    if (!isVisible || typeof window === 'undefined') {
      // Close popup if it's open and visibility is false
      if (isPopupOpenRef.current && popupWindowRef.current && !popupWindowRef.current.closed) {
        console.log('FloatingWindow: Closing popup (not visible)');
        cleanup();
      }
      return;
    }

    // If no participants yet, wait
    if (!participants || participants.length === 0) {
      console.log('FloatingWindow: Waiting for participants...');
      return;
    }

    // Check if popup is already open
    if (isPopupOpenRef.current && popupWindowRef.current && !popupWindowRef.current.closed) {
      // Popup is already open, don't recreate
      return;
    }

    // Open new popup window
    console.log('FloatingWindow: Opening new popup with', participants.length, 'participants');
    isPopupOpenRef.current = true;

    const width = 380;
    const height = 320;
    const left = window.screen.width - width - 20;
    const top = 80;

    const popup = window.open(
      '',
      'FloatingVideoWindow',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no,status=no,menubar=no,toolbar=no,location=no`
    );

    if (!popup) {
      console.warn('Failed to open popup window. Please allow popups for this site.');
      isPopupOpenRef.current = false;
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          alert('Please allow popups for this site to use the floating window feature.\n\nYou can enable popups in your browser settings.');
        }, 100);
      }
      return;
    }

    popupWindowRef.current = popup;

    // Set up the popup window content with tabs
    setupPopupWindow(popup, participants, onClose);

    // Monitor if popup is closed by user
    checkIntervalRef.current = setInterval(() => {
      if (popup.closed) {
        console.log('FloatingWindow: Popup was closed by user');
        isPopupOpenRef.current = false;
        cleanup();
        onClose?.();
      }
    }, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  // Separate effect to update participants when they change
  useEffect(() => {
    if (!isPopupOpenRef.current || !popupWindowRef.current || popupWindowRef.current.closed) {
      return;
    }

    if (!participants || participants.length === 0) {
      return;
    }

    // Update existing popup with new participants
    console.log('FloatingWindow: Updating participants in existing popup');
    participantsRef.current = participants;
    updatePopupParticipants(popupWindowRef.current, participants);
  }, [participants]);

  // Only cleanup when component unmounts
  useEffect(() => {
    return () => {
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
    isPopupOpenRef.current = false;
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
    participants: Participant[],
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
          <title>Meeting - ${participants[0]?.userName || 'Video'}</title>
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
              background: rgba(0,0,0,0.9);
              padding: 8px 12px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 1px solid rgba(255,255,255,0.1);
              z-index: 20;
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
            .tabs {
              background: rgba(0,0,0,0.8);
              display: flex;
              gap: 4px;
              padding: 6px 8px;
              overflow-x: auto;
              border-bottom: 1px solid rgba(255,255,255,0.1);
              scrollbar-width: thin;
            }
            .tabs::-webkit-scrollbar {
              height: 4px;
            }
            .tabs::-webkit-scrollbar-thumb {
              background: rgba(255,255,255,0.3);
              border-radius: 2px;
            }
            .tab {
              background: rgba(255,255,255,0.1);
              border: none;
              color: rgba(255,255,255,0.7);
              padding: 6px 12px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 11px;
              white-space: nowrap;
              transition: all 0.2s;
              display: flex;
              align-items: center;
              gap: 4px;
            }
            .tab:hover {
              background: rgba(255,255,255,0.15);
              color: white;
            }
            .tab.active {
              background: rgba(59,130,246,0.8);
              color: white;
            }
            .video-container {
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #000;
              position: relative;
            }
            video {
              width: 100%;
              height: 100%;
              object-fit: contain;
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
            .footer {
              background: rgba(0,0,0,0.8);
              padding: 6px;
              text-align: center;
              border-top: 1px solid rgba(255,255,255,0.1);
            }
            .footer-text {
              color: rgba(255,255,255,0.5);
              font-size: 9px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">
              <span id="icon">📹</span>
              <span id="currentName">Meeting</span>
            </div>
            <button class="close-btn" onclick="window.close()" title="Close window">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="tabs" id="tabs"></div>
          <div class="video-container">
            <div class="status" id="status">
              <div class="spinner"></div>
              <div>Connecting...</div>
            </div>
            <video id="video" autoplay playsinline></video>
          </div>
          <div class="footer">
            <div class="footer-text">Always on top • Switch tabs to view different participants</div>
          </div>
          <script>
            let participants = [];
            let currentIndex = 0;
            let videoStreams = new Map();

            // Keep window always on top
            window.focus();
            setInterval(() => {
              if (!document.hidden) {
                window.focus();
              }
            }, 1000);

            function switchToParticipant(index) {
              if (index < 0 || index >= participants.length) {
                console.log('Invalid index:', index);
                return;
              }
              
              currentIndex = index;
              const participant = participants[index];
              const video = document.getElementById('video');
              const status = document.getElementById('status');
              const icon = document.getElementById('icon');
              const currentName = document.getElementById('currentName');
              
              console.log('Switching to participant:', participant.userName, participant.id);
              
              // Update UI
              icon.textContent = participant.isScreenShare ? '🖥️' : '📹';
              currentName.textContent = participant.userName;
              document.title = (participant.isScreenShare ? 'Screen Share' : 'Video') + ' - ' + participant.userName;
              
              // Update tabs
              document.querySelectorAll('.tab').forEach((tab, i) => {
                tab.classList.toggle('active', i === index);
              });
              
              // Get stream from window.videoStreams (set by parent)
              const stream = window.videoStreams ? window.videoStreams.get(participant.id) : null;
              
              console.log('Stream found:', stream ? stream.id : 'none');
              
              if (stream && video) {
                video.srcObject = stream;
                video.muted = !participant.isScreenShare;
                video.play().then(() => {
                  console.log('Video playing successfully');
                  status.style.display = 'none';
                }).catch(err => {
                  console.error('Error playing video:', err);
                  // Retry after a short delay
                  setTimeout(() => {
                    video.play().then(() => {
                      console.log('Video playing after retry');
                      status.style.display = 'none';
                    }).catch(e => console.error('Retry failed:', e));
                  }, 500);
                });
              } else {
                console.error('No stream available for participant:', participant.id);
                status.style.display = 'flex';
              }
            }

            function updateParticipants(newParticipants) {
              console.log('Updating participants:', newParticipants.length);
              participants = newParticipants;
              const tabsContainer = document.getElementById('tabs');
              tabsContainer.innerHTML = '';
              
              participants.forEach((p, index) => {
                const tab = document.createElement('button');
                tab.className = 'tab' + (index === currentIndex ? ' active' : '');
                const displayName = p.userName.split(' - ')[0].substring(0, 15);
                tab.innerHTML = (p.isScreenShare ? '🖥️' : '📹') + ' ' + displayName;
                tab.onclick = () => switchToParticipant(index);
                tabsContainer.appendChild(tab);
              });
              
              // Switch to first participant if current index is invalid
              if (currentIndex >= participants.length) {
                currentIndex = 0;
              }
              
              // Small delay to ensure streams are set
              setTimeout(() => {
                switchToParticipant(currentIndex);
              }, 100);
            }

            // Handle messages from parent
            window.addEventListener('message', (event) => {
              if (event.data.type === 'UPDATE_PARTICIPANTS') {
                updateParticipants(event.data.participants);
              } else if (event.data.type === 'SET_STREAM') {
                videoStreams.set(event.data.id, event.data.stream);
                // If this is the current participant, update video
                if (participants[currentIndex]?.id === event.data.id) {
                  switchToParticipant(currentIndex);
                }
              }
            });

            // Notify parent when ready
            if (window.opener) {
              window.opener.postMessage({ type: 'POPUP_READY' }, '*');
            }
          </script>
        </body>
      </html>
    `);
    doc.close();

    // Wait for popup to be ready, then set participants and streams
    setTimeout(() => {
      updatePopupParticipants(popup, participants);
    }, 100);
  };

  const updatePopupParticipants = (popup: Window, participants: Participant[]) => {
    try {
      if (!popup || popup.closed) {
        console.error('FloatingWindow: Popup is closed');
        return;
      }

      console.log('FloatingWindow: Updating popup with', participants.length, 'participants');

      // Store streams directly in popup's window object
      if (!(popup as any).videoStreams) {
        (popup as any).videoStreams = new Map();
      }
      
      participants.forEach(p => {
        if (p.stream) {
          console.log('FloatingWindow: Setting stream for', p.userName, p.stream.id);
          (popup as any).videoStreams.set(p.id, p.stream);
        }
      });

      // Send participant info (without streams)
      const participantInfo = participants.map(p => ({
        id: p.id,
        userName: p.userName,
        isScreenShare: p.isScreenShare
      }));
      
      popup.postMessage({ type: 'UPDATE_PARTICIPANTS', participants: participantInfo }, '*');
      
      console.log('FloatingWindow: Participants updated successfully');
    } catch (err) {
      console.error('FloatingWindow: Error updating popup participants:', err);
    }
  };

  // This component doesn't render anything in the main window
  return null;
}
