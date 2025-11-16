'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import SimplePeer from 'simple-peer';

interface Peer {
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

export default function RoomPage() {
  const resolvedParams = useParams<{ id: string }>();
  const resolvedSearchParams = useSearchParams();
  const userName = resolvedSearchParams.get('name') || 'Guest';
  const roomId = resolvedParams.id;

  const [peers, setPeers] = useState<Peer[]>([]);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenSharingUserId, setScreenSharingUserId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedChatUser, setSelectedChatUser] = useState<string>('everyone');

  const socketRef = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Peer[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin;
    socketRef.current = io(socketUrl, {
      transports: ['websocket', 'polling'],
    });

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        socketRef.current?.emit('join-room', { roomId, userName });

        socketRef.current?.on('existing-users', (users: any[]) => {
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
          if (item) {
            item.peer.signal(signal);
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

        socketRef.current?.on('screen-share-started', ({ userId }) => {
          setScreenSharingUserId(userId);
        });

        socketRef.current?.on('screen-share-stopped', ({ userId }) => {
          if (screenSharingUserId === userId) {
            setScreenSharingUserId(null);
          }
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
      socketRef.current?.disconnect();
    };
  }, [roomId, userName]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function createPeer(userToSignal: string, stream: MediaStream) {
    const peer = new SimplePeer({
      initiator: true,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    });

    peer.on('signal', (signal) => {
      socketRef.current?.emit('signal', { to: userToSignal, signal });
    });

    peer.on('stream', (remoteStream) => {
      const peerIndex = peersRef.current.findIndex((p) => p.userId === userToSignal);
      if (peerIndex !== -1) {
        peersRef.current[peerIndex].stream = remoteStream;
        setPeers([...peersRef.current]);
      }
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
    });

    return peer;
  }

  function addPeer(incomingSignal: string, stream: MediaStream) {
    const peer = new SimplePeer({
      initiator: false,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    });

    peer.on('signal', (signal) => {
      socketRef.current?.emit('signal', { to: incomingSignal, signal });
    });

    peer.on('stream', (remoteStream) => {
      const peerIndex = peersRef.current.findIndex((p) => p.userId === incomingSignal);
      if (peerIndex !== -1) {
        peersRef.current[peerIndex].stream = remoteStream;
        setPeers([...peersRef.current]);
      }
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
    });

    return peer;
  }

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
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' } as MediaTrackConstraints,
          audio: false,
        });

        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = screenStream;
        }

        peersRef.current.forEach(({ peer }) => {
          try {
            const videoSender = (peer as any)._pc?.getSenders().find((s: RTCRtpSender) => s.track?.kind === 'video');
            if (videoSender) {
              videoSender.replaceTrack(screenTrack);
            }
          } catch (err) {
            console.error('Error replacing track:', err);
          }
        });

        screenTrack.onended = () => {
          stopScreenShare();
        };

        setIsScreenSharing(true);
        setScreenSharingUserId('local');
        socketRef.current?.emit('screen-share-started', { roomId });
      } catch (err) {
        console.error('Error sharing screen:', err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];

      peersRef.current.forEach(({ peer }) => {
        try {
          const videoSender = (peer as any)._pc?.getSenders().find((s: RTCRtpSender) => s.track?.kind === 'video');
          if (videoSender && videoTrack) {
            videoSender.replaceTrack(videoTrack);
          }
        } catch (err) {
          console.error('Error restoring track:', err);
        }
      });
    }

    setIsScreenSharing(false);
    if (screenSharingUserId === 'local') {
      setScreenSharingUserId(null);
    }
    socketRef.current?.emit('screen-share-stopped', { roomId });
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
          </p>
        </div>
        <button
          onClick={() => setShowChat(!showChat)}
          className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors relative"
        >
          <span className="text-xl">💬</span>
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
                    <>
                      <video
                        ref={screenVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 px-4 py-2 rounded-lg">
                        <span className="text-sm font-semibold">{userName} (You) - Sharing Screen</span>
                      </div>
                    </>
                  ) : (
                    (() => {
                      const sharingPeer = peers.find((p) => p.userId === screenSharingUserId);
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
                <div className="w-40 h-full relative bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
                  <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 px-2 py-1 rounded text-xs">
                    {userName} (You)
                  </div>
                  {!isVideoEnabled && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                      <span className="text-3xl">👤</span>
                    </div>
                  )}
                </div>

                {peers
                  .filter((p) => p.userId !== screenSharingUserId)
                  .map((peer) => (
                    <div
                      key={peer.userId}
                      className="w-40 h-full relative bg-gray-800 rounded-lg overflow-hidden flex-shrink-0"
                    >
                      <VideoCard peer={peer.peer} userName={peer.userName} isMainView={false} />
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
            } transition-colors`}
            title={isAudioEnabled ? 'Mute' : 'Unmute'}
          >
            <span className="text-xl">{isAudioEnabled ? '🎤' : '🔇'}</span>
          </button>

          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full ${
              isVideoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
            } transition-colors`}
            title={isVideoEnabled ? 'Stop video' : 'Start video'}
          >
            <span className="text-xl">{isVideoEnabled ? '📹' : '📵'}</span>
          </button>

          <button
            onClick={toggleScreenShare}
            className={`p-3 rounded-full ${
              isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
            } transition-colors`}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            <span className="text-xl">🖥️</span>
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

  useEffect(() => {
    peer.on('stream', (stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        setHasVideo(videoTrack.enabled);
        videoTrack.onended = () => setHasVideo(false);
      }
    });
  }, [peer]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full ${isMainView ? 'object-contain' : 'object-cover'}`}
      />
      <div
        className={`absolute ${
          isMainView ? 'bottom-4 left-4 px-4 py-2 rounded-lg' : 'bottom-2 left-2 px-3 py-1 rounded'
        } bg-black bg-opacity-70`}
      >
        <span className={`${isMainView ? 'text-sm font-semibold' : 'text-sm'}`}>{userName}</span>
      </div>
      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
          <span className={`${isMainView ? 'text-8xl' : 'text-6xl'}`}>👤</span>
        </div>
      )}
    </>
  );
}
