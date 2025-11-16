'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import SimplePeer from 'simple-peer';

// Development logging utility
const isDev = process.env.NODE_ENV === 'development';
const devLog = (...args: unknown[]) => {
  if (isDev) {
    console.log(...args);
  }
};

interface Peer {
  peer: SimplePeer.Instance;
  userId: string;
  userName: string;
  stream?: MediaStream;
}

interface ScreenPeer {
  peer: SimplePeer.Instance;
  userId: string;
  userName: string;
  stream?: MediaStream;
}

interface ChatMessage {
  id: string;
  userName: string;
  userId: string;
  message: string;
  timestamp: number;
  isPrivate?: boolean;
  recipientId?: string;
}

// Device and browser detection utilities
const getDeviceInfo = () => {
  const ua = navigator.userAgent.toLowerCase();
  
  // Detect mobile/tablet
  const isMobile = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua);
  const isTablet = /ipad|android(?!.*mobile)/i.test(ua);
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  
  // Detect browser - order matters!
  const isEdge = /edg/i.test(ua);
  const isChrome = /chrome/i.test(ua) && !/edg/i.test(ua);
  const isFirefox = /firefox/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/chrome/i.test(ua) && !/android/i.test(ua);
  
  // Screen share support - now available on all devices with getDisplayMedia
  const isDesktopDevice = !isMobile && !isTablet;
  const hasGetDisplayMedia = typeof navigator.mediaDevices?.getDisplayMedia === 'function';
  
  // Enable screen share for all devices that support getDisplayMedia API
  // iOS 15.4+ Safari supports screen sharing
  const supportsScreenShare = hasGetDisplayMedia;

  return {
    isMobile: isMobile && !isTablet,
    isTablet,
    isDesktop: isDesktopDevice,
    isIOS,
    isAndroid,
    isSafari,
    isChrome,
    isFirefox,
    isEdge,
    supportsScreenShare,
    userAgent: navigator.userAgent,
  };
};

export default function RoomPage() {
  const resolvedParams = useParams<{ id: string }>();
  const resolvedSearchParams = useSearchParams();
  const userName = resolvedSearchParams.get('name') || 'Guest';
  const roomId = resolvedParams.id;

  const [peers, setPeers] = useState<Peer[]>([]);
  const [screenPeers, setScreenPeers] = useState<ScreenPeer[]>([]); // Separate peers for screen sharing
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenSharingUserId, setScreenSharingUserId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedChatUser, setSelectedChatUser] = useState<string>('everyone');
  const [deviceInfo, setDeviceInfo] = useState<ReturnType<typeof getDeviceInfo> | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Peer[]>([]);
  const screenPeersRef = useRef<ScreenPeer[]>([]); // Separate ref for screen peers
  const screenStreamRef = useRef<MediaStream | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Peer creation functions - declared before useEffect to avoid hoisting issues
  const createPeer = (userToSignal: string, stream: MediaStream) => {
    const peer = new SimplePeer({
      initiator: true,
      trickle: true,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
        ],
      },
    });

    peer.on('signal', (signal) => {
      socketRef.current?.emit('signal', { to: userToSignal, signal });
    });

    peer.on('stream', (remoteStream) => {
      devLog(`Received camera stream from ${userToSignal}:`, remoteStream.id);
      const peerIndex = peersRef.current.findIndex((p) => p.userId === userToSignal);
      if (peerIndex !== -1) {
        peersRef.current[peerIndex].stream = remoteStream;
        setPeers([...peersRef.current]);
        devLog(`Camera stream set for peer ${userToSignal}`);
      }
    });

    peer.on('error', (err: Error) => {
      if (err.message?.includes('User-Initiated Abort') || err.message?.includes('Close called')) {
        return;
      }
      console.error('Peer error:', err);
    });

    peer.on('close', () => {
      // Peer connection closed
    });

    return peer;
  };

  const addPeer = (incomingSignal: string, stream: MediaStream) => {
    const peer = new SimplePeer({
      initiator: false,
      trickle: true,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
        ],
      },
    });

    peer.on('signal', (signal) => {
      socketRef.current?.emit('signal', { to: incomingSignal, signal });
    });

    peer.on('stream', (remoteStream) => {
      console.log(`Received camera stream from ${incomingSignal}:`, remoteStream.id);
      const peerIndex = peersRef.current.findIndex((p) => p.userId === incomingSignal);
      if (peerIndex !== -1) {
        peersRef.current[peerIndex].stream = remoteStream;
        setPeers([...peersRef.current]);
        console.log(`Camera stream set for peer ${incomingSignal}`);
      }
    });

    peer.on('error', (err: Error) => {
      if (err.message?.includes('User-Initiated Abort') || err.message?.includes('Close called')) {
        return;
      }
      console.error('Peer error:', err);
    });

    peer.on('close', () => {
      // Peer connection closed
    });

    return peer;
  };

  const createScreenPeer = (userToSignal: string, stream: MediaStream) => {
    const peer = new SimplePeer({
      initiator: true,
      trickle: true,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
        ],
      },
    });

    peer.on('signal', (signal) => {
      socketRef.current?.emit('screen-signal', { to: userToSignal, signal });
    });

    peer.on('stream', (remoteStream) => {
      const peerIndex = screenPeersRef.current.findIndex((p) => p.userId === userToSignal);
      if (peerIndex !== -1) {
        screenPeersRef.current[peerIndex].stream = remoteStream;
        setScreenPeers([...screenPeersRef.current]);
      }
    });

    peer.on('error', (err: Error) => {
      if (err.message?.includes('User-Initiated Abort') || err.message?.includes('Close called')) {
        return;
      }
      console.error('Screen peer error:', err);
    });

    return peer;
  };

  const addScreenPeer = (incomingSignal: string, stream: MediaStream) => {
    const peer = new SimplePeer({
      initiator: false,
      trickle: true,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
        ],
      },
    });

    peer.on('signal', (signal) => {
      socketRef.current?.emit('screen-signal', { to: incomingSignal, signal });
    });

    peer.on('stream', (remoteStream) => {
      console.log(`Screen peer received stream from ${incomingSignal}:`, remoteStream.id);
      const peerIndex = screenPeersRef.current.findIndex((p) => p.userId === incomingSignal);
      if (peerIndex !== -1) {
        screenPeersRef.current[peerIndex].stream = remoteStream;
        setScreenPeers([...screenPeersRef.current]);
        console.log(`Screen peer stream set for ${incomingSignal}`);
      }
    });

    peer.on('error', (err: Error) => {
      if (err.message?.includes('User-Initiated Abort') || err.message?.includes('Close called')) {
        return;
      }
      console.error('Screen peer error:', err);
    });

    return peer;
  };

  useEffect(() => {
    // Detect device and browser info
    const info = getDeviceInfo();
    setDeviceInfo(info);
    devLog('Device Info:', info);

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin;
    socketRef.current = io(socketUrl, {
      transports: ['websocket', 'polling'],
    });

    // Optimize video constraints based on device
    const getVideoConstraints = () => {
      if (info.isMobile) {
        return {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 24, max: 30 },
          facingMode: 'user',
        };
      } else if (info.isTablet) {
        return {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30 },
        };
      } else {
        return {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        };
      }
    };

    navigator.mediaDevices
      .getUserMedia({
        video: getVideoConstraints(),
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      .then((stream) => {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        socketRef.current?.emit('join-room', { roomId, userName });

        socketRef.current?.on('existing-users', (users: Array<{ userId: string; userName: string }>) => {
          const newPeers: Peer[] = [];
          users.forEach((user) => {
            const peer = createPeer(user.userId, stream);
            newPeers.push({
              peer,
              userId: user.userId,
              userName: user.userName,
            });
          });
          peersRef.current = newPeers;
          setPeers(newPeers);
        });

        socketRef.current?.on('user-joined', ({ userId, userName: newUserName }) => {
          const peer = addPeer(userId, stream);
          const newPeer = {
            peer,
            userId,
            userName: newUserName,
          };
          peersRef.current = [...peersRef.current, newPeer];
          setPeers([...peersRef.current]);
        });

        socketRef.current?.on('signal', ({ from, signal }) => {
          const item = peersRef.current.find((p) => p.userId === from);
          if (item && item.peer) {
            try {
              // Check if peer is not destroyed before signaling
              const peerInternal = item.peer as SimplePeer.Instance & { destroyed?: boolean; _destroying?: boolean };
              if (!peerInternal.destroyed && !peerInternal._destroying) {
                item.peer.signal(signal);
              } else {
                console.log(`Ignoring signal for destroyed peer ${from}`);
              }
            } catch (err) {
              const error = err as Error;
              // Silently ignore errors for destroyed peers
              if (!error.message?.includes('cannot signal after peer is destroyed')) {
                console.error('Error signaling peer:', error);
              }
            }
          }
        });

        socketRef.current?.on('user-left', ({ userId }) => {
          const peerObj = peersRef.current.find((p) => p.userId === userId);
          if (peerObj) {
            peerObj.peer.destroy();
          }
          peersRef.current = peersRef.current.filter((p) => p.userId !== userId);
          setPeers(peersRef.current);

          if (screenSharingUserId === userId) {
            setScreenSharingUserId(null);
          }
          
          if (selectedChatUser === userId) {
            setSelectedChatUser('everyone');
          }
        });

        socketRef.current?.on('chat-message', ({ userId, userName: senderName, message, timestamp }) => {
          setMessages((prev) => [
            ...prev,
            { id: `${userId}-${timestamp}`, userName: senderName, userId, message, timestamp, isPrivate: false },
          ]);
        });

        socketRef.current?.on('private-message', ({ userId, userName: senderName, message, timestamp }) => {
          setMessages((prev) => [
            ...prev,
            {
              id: `${userId}-${timestamp}`,
              userName: senderName,
              userId,
              message,
              timestamp,
              isPrivate: true,
              recipientId: socketRef.current?.id || 'local',
            },
          ]);
        });

        // Handle screen share peer signaling (separate from camera peers)
        socketRef.current?.on('screen-signal', ({ from, signal }) => {
          const item = screenPeersRef.current.find((p) => p.userId === from);
          if (item && item.peer) {
            try {
              const peerInternal = item.peer as SimplePeer.Instance & { destroyed?: boolean; _destroying?: boolean };
              if (!peerInternal.destroyed && !peerInternal._destroying) {
                item.peer.signal(signal);
              }
            } catch (err) {
              const error = err as Error;
              if (!error.message?.includes('cannot signal after peer is destroyed')) {
                console.error('Error signaling screen peer:', error);
              }
            }
          }
        });

        socketRef.current?.on('screen-share-started', ({ userId }) => {
          console.log(`User ${userId} started screen sharing`);
          setScreenSharingUserId(userId);
          
          // Create screen peer to receive their screen share (only if it's not us)
          if (userId !== socketRef.current?.id) {
            // Create a dummy stream for the receiver (won't be used, just for SimplePeer)
            const dummyStream = new MediaStream();
            const screenPeer = addScreenPeer(userId, dummyStream);
            const peerName = peersRef.current.find(p => p.userId === userId)?.userName || 'Unknown';
            const newScreenPeer = {
              peer: screenPeer,
              userId,
              userName: peerName,
            };
            screenPeersRef.current = [...screenPeersRef.current, newScreenPeer];
            setScreenPeers([...screenPeersRef.current]);
            console.log(`Created screen peer to receive from ${peerName}`);
          }
        });

        socketRef.current?.on('screen-share-stopped', ({ userId }) => {
          console.log(`User ${userId} stopped screen sharing`);
          if (screenSharingUserId === userId) {
            setScreenSharingUserId(null);
          }
          
          // Destroy screen peer
          const screenPeer = screenPeersRef.current.find((p) => p.userId === userId);
          if (screenPeer) {
            screenPeer.peer.destroy();
          }
          screenPeersRef.current = screenPeersRef.current.filter((p) => p.userId !== userId);
          setScreenPeers(screenPeersRef.current);
        });
      })
      .catch((err) => {
        console.error('Error accessing media devices:', err);
        alert('Please allow camera and microphone access');
      });

    return () => {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      peersRef.current.forEach((p) => p.peer.destroy());
      screenPeersRef.current.forEach((p) => p.peer.destroy());
      socketRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userName]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        // Check device support
        if (!deviceInfo?.supportsScreenShare) {
          alert('Screen sharing is not supported on this browser. Please update to the latest version or try a different browser.');
          return;
        }

        // Universal screen share constraints that work across all devices
        interface ScreenShareConstraints {
          video: boolean | (MediaTrackConstraints & {
            cursor?: string;
            mediaSource?: string;
            displaySurface?: string;
            width?: { ideal: number };
            height?: { ideal: number };
            frameRate?: { ideal: number };
          });
          audio: boolean;
        }

        const constraints: ScreenShareConstraints = {
          video: true,
          audio: false,
        };

        // Add device and browser-specific optimizations
        if (deviceInfo?.isIOS) {
          // iOS Safari - keep it simple, let the system handle it
          constraints.video = true;
        } else if (deviceInfo?.isMobile || deviceInfo?.isTablet) {
          // Android mobile/tablet optimizations
          if (typeof constraints.video !== 'boolean') {
            constraints.video = {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 24 },
            };
          }
        } else if (deviceInfo?.isChrome || deviceInfo?.isEdge) {
          // Desktop Chrome/Edge
          constraints.video = {
            cursor: 'always',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          };
        } else if (deviceInfo?.isFirefox) {
          // Desktop Firefox
          constraints.video = {
            mediaSource: 'screen',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          };
        } else if (deviceInfo?.isSafari && deviceInfo?.isDesktop) {
          // Desktop Safari
          constraints.video = {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          };
        }

        console.log('Starting screen share with constraints:', constraints);
        const screenStream = await navigator.mediaDevices.getDisplayMedia(constraints);

        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        console.log('Screen track obtained:', screenTrack.label, screenTrack.getSettings());

        // Update state to trigger UI change
        setIsScreenSharing(true);
        setScreenSharingUserId('local');

        // Create screen share stream with audio
        const audioTrack = localStreamRef.current?.getAudioTracks()[0];
        const screenStreamWithAudio = new MediaStream([screenTrack]);
        if (audioTrack) {
          screenStreamWithAudio.addTrack(audioTrack);
        }

        // Create SEPARATE screen share peers (camera peers stay active!)
        peersRef.current.forEach(({ userId, userName }) => {
          try {
            const screenPeer = createScreenPeer(userId, screenStreamWithAudio);
            screenPeersRef.current.push({
              peer: screenPeer,
              userId,
              userName,
            });
          } catch (err) {
            console.error(`Error creating screen peer for ${userId}:`, err);
          }
        });
        setScreenPeers([...screenPeersRef.current]);

        // Handle when user stops sharing via browser UI
        screenTrack.onended = () => {
          console.log('Screen share ended by user');
          stopScreenShare();
        };

        // Notify server we're starting screen share
        socketRef.current?.emit('screen-share-started', { roomId });
        console.log('Screen sharing started successfully');
      } catch (err) {
        const error = err as Error & { name?: string };
        console.error('Error sharing screen:', error);
        if (error.name === 'NotAllowedError') {
          // User cancelled screen share
          return;
        }
        alert('Failed to share screen. Please try again.');
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    console.log('Stopping screen share...');
    
    // Stop screen share tracks
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log('Stopped screen track:', track.label);
      });
      screenStreamRef.current = null;
    }

    // Destroy ONLY the screen share peers (camera peers stay active!)
    screenPeersRef.current.forEach(({ peer }) => {
      try {
        peer.destroy();
      } catch (err) {
        console.error('Error destroying screen peer:', err);
      }
    });
    
    // Clear screen peers
    screenPeersRef.current = [];
    setScreenPeers([]);

    // Update state
    setIsScreenSharing(false);
    setScreenSharingUserId(null);
    socketRef.current?.emit('screen-share-stopped', { roomId });
    console.log('Screen share stopped, camera restored');
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      const message = {
        roomId,
        userName,
        message: newMessage.trim(),
        timestamp: Date.now(),
      };

      if (selectedChatUser === 'everyone') {
        socketRef.current?.emit('chat-message', message);
        setMessages((prev) => [
          ...prev,
          {
            id: `local-${message.timestamp}`,
            userName: 'You',
            userId: socketRef.current?.id || 'local',
            message: newMessage.trim(),
            timestamp: message.timestamp,
            isPrivate: false,
          },
        ]);
      } else {
        socketRef.current?.emit('private-message', { ...message, to: selectedChatUser });
        const recipientName = peers.find((p) => p.userId === selectedChatUser)?.userName;
        setMessages((prev) => [
          ...prev,
          {
            id: `local-${message.timestamp}`,
            userName: `You → ${recipientName}`,
            userId: socketRef.current?.id || 'local',
            message: newMessage.trim(),
            timestamp: message.timestamp,
            isPrivate: true,
            recipientId: selectedChatUser,
          },
        ]);
      }
      setNewMessage('');
    }
  };

  const leaveRoom = () => {
    window.location.href = `/event/${roomId}`;
  };

  const filteredMessages =
    selectedChatUser === 'everyone'
      ? messages.filter((m) => !m.isPrivate)
      : messages.filter(
          (m) =>
            m.isPrivate &&
            (m.userId === selectedChatUser || m.recipientId === selectedChatUser)
        );

  const totalParticipants = peers.length + 1;
  const getGridClass = () => {
    if (screenSharingUserId) return '';
    if (totalParticipants === 1) return 'grid-cols-1';
    if (totalParticipants === 2) return 'grid-cols-1 md:grid-cols-2';
    if (totalParticipants <= 4) return 'grid-cols-1 md:grid-cols-2';
    if (totalParticipants <= 6) return 'grid-cols-2 md:grid-cols-3';
    return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700 flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold">Room: {roomId}</h2>
          <p className="text-xs text-gray-400">
            {totalParticipants} participant{totalParticipants !== 1 ? 's' : ''}
            {deviceInfo && (
              <span className="ml-2 opacity-60">
                • {deviceInfo.isMobile ? '📱' : deviceInfo.isTablet ? '📱' : '💻'}{' '}
                {deviceInfo.isChrome
                  ? 'Chrome'
                  : deviceInfo.isFirefox
                    ? 'Firefox'
                    : deviceInfo.isSafari
                      ? 'Safari'
                      : deviceInfo.isEdge
                        ? 'Edge'
                        : 'Browser'}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowChat(!showChat)}
          className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors relative flex items-center justify-center"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          {messages.length > 0 && !showChat && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {messages.length}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {screenSharingUserId ? (
            <>
              <div className="flex-1 bg-black p-4 overflow-hidden">
                <div className="h-full bg-gray-900 rounded-lg overflow-hidden relative">
                  {screenSharingUserId === 'local' ? (
                    <LocalScreenShare 
                      stream={screenStreamRef.current} 
                      userName={userName}
                    />
                  ) : (
                    (() => {
                      const sharingPeer = screenPeers.find((p) => p.userId === screenSharingUserId);
                      return sharingPeer ? (
                        <VideoCard
                          peer={sharingPeer.peer}
                          userName={`${sharingPeer.userName} - Sharing Screen`}
                          isMainView={true}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-800">
                          <span className="text-gray-400">Loading screen share...</span>
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>

              <div className="h-32 bg-gray-900 px-4 pb-4 flex gap-2 overflow-x-auto flex-shrink-0">
                {/* Always show local camera in strip when screen sharing is active */}
                <LocalVideoStrip 
                  stream={localStreamRef.current} 
                  userName={userName} 
                  isVideoEnabled={isVideoEnabled}
                />

                {/* Show all other participants' cameras */}
                {peers.map((peer) => (
                  <div
                    key={`strip-${peer.userId}`}
                    className="w-40 h-full relative bg-gray-800 rounded-lg overflow-hidden flex-shrink-0"
                  >
                    <VideoCardStrip 
                      key={`video-${peer.userId}-${peer.stream?.id || 'no-stream'}`}
                      peer={peer.peer} 
                      userName={peer.userName} 
                      stream={peer.stream} 
                    />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className={`flex-1 p-4 grid ${getGridClass()} gap-4 auto-rows-fr overflow-auto`}>
              <div className="relative bg-gray-800 rounded-lg overflow-hidden min-h-[200px]">
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 px-3 py-1 rounded text-sm">
                  {userName} (You)
                </div>
                {!isVideoEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                    <span className="text-6xl">👤</span>
                  </div>
                )}
              </div>

              {peers.map((peer) => (
                <div key={peer.userId} className="relative bg-gray-800 rounded-lg overflow-hidden min-h-[200px]">
                  <VideoCard peer={peer.peer} userName={peer.userName} isMainView={false} />
                </div>
              ))}
            </div>
          )}
        </div>

        {showChat && (
          <div className="w-full md:w-80 bg-gray-800 border-l border-gray-700 flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-gray-700 flex-shrink-0">
              <h3 className="font-semibold mb-2">Chat</h3>
              <select
                value={selectedChatUser}
                onChange={(e) => setSelectedChatUser(e.target.value)}
                className="w-full bg-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="everyone">Everyone</option>
                {peers.map((peer) => (
                  <option key={peer.userId} value={peer.userId}>
                    {peer.userName} (Private)
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredMessages.length === 0 ? (
                <div className="text-center text-gray-500 text-sm mt-4">
                  {selectedChatUser === 'everyone' ? 'No messages yet' : 'No private messages yet'}
                </div>
              ) : (
                filteredMessages.map((msg) => (
                  <div key={msg.id} className={`rounded-lg p-3 ${msg.isPrivate ? 'bg-blue-900' : 'bg-gray-700'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-blue-400">
                        {msg.userName} {msg.isPrivate && '🔒'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm break-words">{msg.message}</p>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={sendMessage} className="p-4 border-t border-gray-700 flex-shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Message ${
                    selectedChatUser === 'everyone'
                      ? 'everyone'
                      : peers.find((p) => p.userId === selectedChatUser)?.userName
                  }...`}
                  className="flex-1 bg-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <div className="bg-gray-800 border-t border-gray-700 p-4 flex-shrink-0">
        <div className="flex justify-center gap-3">
          <button
            onClick={toggleAudio}
            className={`p-3 rounded-full ${
              isAudioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
            } transition-colors flex items-center justify-center`}
            title={isAudioEnabled ? 'Mute' : 'Unmute'}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isAudioEnabled ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                />
              )}
            </svg>
          </button>

          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full ${
              isVideoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
            } transition-colors flex items-center justify-center`}
            title={isVideoEnabled ? 'Stop video' : 'Start video'}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isVideoEnabled ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              )}
            </svg>
          </button>

          <button
            onClick={toggleScreenShare}
            className={`p-3 rounded-full ${
              isScreenSharing
                ? 'bg-blue-600 hover:bg-blue-700'
                : deviceInfo?.supportsScreenShare
                  ? 'bg-gray-700 hover:bg-gray-600'
                  : 'bg-gray-600 opacity-50 cursor-not-allowed'
            } transition-colors flex items-center justify-center`}
            title={
              !deviceInfo?.supportsScreenShare
                ? 'Screen sharing not supported - please update your browser'
                : isScreenSharing
                  ? 'Stop sharing'
                  : 'Share screen'
            }
            disabled={!deviceInfo?.supportsScreenShare}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isScreenSharing ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              )}
            </svg>
          </button>

          <button
            onClick={leaveRoom}
            className="p-3 px-6 rounded-full bg-red-600 hover:bg-red-700 transition-colors font-semibold"
            title="Leave meeting"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

function VideoCard({
  peer,
  userName,
  isMainView = false,
}: {
  peer: SimplePeer.Instance;
  userName: string;
  isMainView?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(true);
  const [streamSet, setStreamSet] = useState(false);

  useEffect(() => {
    let currentStreamId: string | null = null;
    let isHandlingStream = false;

    const handleStream = (stream: MediaStream) => {
      // Prevent concurrent handling
      if (isHandlingStream) {
        console.log('Already handling stream, skipping');
        return;
      }

      // Prevent handling the same stream multiple times
      if (currentStreamId === stream.id) {
        console.log('Same stream already handled:', stream.id);
        return;
      }

      isHandlingStream = true;
      currentStreamId = stream.id;
      
      console.log('VideoCard handling new stream:', stream.id, 'tracks:', stream.getTracks().length);
      
      // Only update srcObject if it's actually different
      if (videoRef.current) {
        const currentSrc = videoRef.current.srcObject as MediaStream | null;
        if (!currentSrc || currentSrc.id !== stream.id) {
          videoRef.current.srcObject = stream;
          setStreamSet(true);
          
          // Play video
          videoRef.current.play().catch(() => {
            // Retry once after a delay
            setTimeout(() => {
              if (videoRef.current) {
                videoRef.current.play().catch(() => {});
              }
            }, 200);
          });
        }
      }

      // Setup track listeners
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        setHasVideo(videoTrack.enabled);
        
        // Clean up old listeners
        videoTrack.onended = null;
        videoTrack.onmute = null;
        videoTrack.onunmute = null;
        
        // Add new listeners
        videoTrack.onended = () => setHasVideo(false);
        videoTrack.onmute = () => setHasVideo(false);
        videoTrack.onunmute = () => setHasVideo(true);
      }

      isHandlingStream = false;
    };

    peer.on('stream', handleStream);

    return () => {
      peer.off('stream', handleStream);
      currentStreamId = null;
    };
  }, [peer]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className={`w-full h-full ${isMainView ? 'object-contain bg-black' : 'object-cover'}`}
      />
      <div
        className={`absolute ${
          isMainView ? 'bottom-4 left-4 px-4 py-2 rounded-lg' : 'bottom-2 left-2 px-3 py-1 rounded'
        } bg-black bg-opacity-70`}
      >
        <span className={`${isMainView ? 'text-sm font-semibold' : 'text-sm'}`}>{userName}</span>
      </div>
      {(!hasVideo || !streamSet) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
          {!streamSet ? (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-2"></div>
              <span className="text-sm">Connecting...</span>
            </div>
          ) : (
            <span className={`${isMainView ? 'text-8xl' : 'text-6xl'}`}>👤</span>
          )}
        </div>
      )}
    </>
  );
}

function LocalScreenShare({
  stream,
  userName,
}: {
  stream: MediaStream | null;
  userName: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playAttemptedRef = useRef(false);

  useEffect(() => {
    if (!stream || !videoRef.current) {
      console.log('LocalScreenShare: No stream or video ref');
      return;
    }

    const videoElement = videoRef.current;
    console.log('LocalScreenShare: Setting up stream', stream.id);

    // Set the stream
    videoElement.srcObject = stream;
    playAttemptedRef.current = false;

    // Handle loaded metadata
    const handleLoadedMetadata = () => {
      if (playAttemptedRef.current) return;
      playAttemptedRef.current = true;
      
      console.log('LocalScreenShare: Metadata loaded, attempting play');
      videoElement.play()
        .then(() => {
          console.log('LocalScreenShare: Playing successfully');
          setIsPlaying(true);
          setError(null);
        })
        .catch((err) => {
          console.error('LocalScreenShare: Play error:', err);
          setError('Failed to play screen share');
          // Retry after a short delay
          setTimeout(() => {
            videoElement.play()
              .then(() => {
                console.log('LocalScreenShare: Retry successful');
                setIsPlaying(true);
                setError(null);
              })
              .catch((retryErr) => {
                console.error('LocalScreenShare: Retry failed:', retryErr);
              });
          }, 500);
        });
    };

    // Handle play event
    const handlePlay = () => {
      console.log('LocalScreenShare: Play event fired');
      setIsPlaying(true);
      setError(null);
    };

    // Handle pause event
    const handlePause = () => {
      console.log('LocalScreenShare: Pause event fired');
      setIsPlaying(false);
    };

    // Handle error event
    const handleError = (e: Event) => {
      console.error('LocalScreenShare: Video error:', e);
      setError('Video playback error');
    };

    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('error', handleError);

    // If metadata is already loaded, play immediately
    if (videoElement.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('pause', handlePause);
      videoElement.removeEventListener('error', handleError);
    };
  }, [stream]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-contain bg-black"
        style={{ maxHeight: '100%', maxWidth: '100%' }}
      />
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 px-4 py-2 rounded-lg z-10">
        <span className="text-sm font-semibold">{userName} (You) - Sharing Screen</span>
      </div>
      {!isPlaying && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
            <span className="text-lg">Starting screen share...</span>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="text-center">
            <span className="text-lg text-red-400">{error}</span>
          </div>
        </div>
      )}
    </>
  );
}

function LocalVideoStrip({
  stream,
  userName,
  isVideoEnabled,
}: {
  stream: MediaStream | null;
  userName: string;
  isVideoEnabled: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div className="w-40 h-full relative bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
      <video 
        ref={videoRef}
        autoPlay 
        muted 
        playsInline 
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 px-2 py-1 rounded text-xs z-10">
        {userName} (You)
      </div>
      {!isVideoEnabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
          <span className="text-3xl">👤</span>
        </div>
      )}
    </div>
  );
}

function VideoCardStrip({
  peer,
  userName,
  stream,
}: {
  peer: SimplePeer.Instance;
  userName: string;
  stream?: MediaStream;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(true);
  const [peerStream, setPeerStream] = useState<MediaStream | null>(null);

  // Derive the active stream from props or peer stream
  const activeStream = stream || peerStream;

  // Listen for stream events from peer if stream prop is not provided
  useEffect(() => {
    if (!stream) {
      const handleStream = (newStream: MediaStream) => {
        console.log(`VideoCardStrip received stream for ${userName}:`, newStream.id);
        setPeerStream(newStream);
      };

      peer.on('stream', handleStream);
      return () => {
        peer.off('stream', handleStream);
      };
    }
  }, [peer, stream, userName]);

  // Update video element when stream changes
  useEffect(() => {
    if (!activeStream || !videoRef.current) return;

    console.log(`Setting video srcObject for ${userName}:`, activeStream.id);
    const videoElement = videoRef.current;
    videoElement.srcObject = activeStream;
    videoElement.play().catch((err) => {
      console.error(`Error playing video for ${userName}:`, err);
    });
    
    const videoTrack = activeStream.getVideoTracks()[0];
    if (!videoTrack) return;

    // Set up event listeners for track state changes
    const updateVideoState = (enabled: boolean) => {
      setHasVideo(enabled);
    };

    const handleEnded = () => updateVideoState(false);
    const handleMute = () => updateVideoState(false);
    const handleUnmute = () => updateVideoState(true);
    
    // Initialize state from track
    updateVideoState(videoTrack.enabled);
    
    videoTrack.addEventListener('ended', handleEnded);
    videoTrack.addEventListener('mute', handleMute);
    videoTrack.addEventListener('unmute', handleUnmute);
    
    return () => {
      videoTrack.removeEventListener('ended', handleEnded);
      videoTrack.removeEventListener('mute', handleMute);
      videoTrack.removeEventListener('unmute', handleUnmute);
    };
  }, [activeStream, userName]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 px-2 py-1 rounded text-xs z-10">
        {userName}
      </div>
      {!hasVideo && activeStream && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
          <span className="text-3xl">👤</span>
        </div>
      )}
      {!activeStream && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-1"></div>
            <span className="text-xs">Connecting...</span>
          </div>
        </div>
      )}
    </>
  );
}
