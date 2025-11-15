'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import SimplePeer from 'simple-peer';

interface Peer {
  peer: SimplePeer.Instance;
  userId: string;
  userName: string;
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

  const socketRef = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Peer[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io('http://localhost:3000');

    // Get user media
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Join room
        socketRef.current?.emit('join-room', { roomId, userName });

        // Handle existing users
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

        // Handle new user joining
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

        // Handle receiving signal
        socketRef.current?.on('signal', ({ from, signal }) => {
          const item = peersRef.current.find((p) => p.userId === from);
          if (item) {
            item.peer.signal(signal);
          }
        });

        // Handle user leaving
        socketRef.current?.on('user-left', ({ userId }) => {
          const peerObj = peersRef.current.find((p) => p.userId === userId);
          if (peerObj) {
            peerObj.peer.destroy();
          }
          peersRef.current = peersRef.current.filter((p) => p.userId !== userId);
          setPeers(peersRef.current);
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

  function createPeer(userId: string, stream: MediaStream) {
    const peer = new SimplePeer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on('signal', (signal) => {
      socketRef.current?.emit('signal', { to: userId, signal });
    });

    return peer;
  }

  function addPeer(userId: string, stream: MediaStream) {
    const peer = new SimplePeer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on('signal', (signal) => {
      socketRef.current?.emit('signal', { to: userId, signal });
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
          video: {
            cursor: 'always',
          } as MediaTrackConstraints,
          audio: false,
        });

        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        // Replace video track in local stream
        if (localStreamRef.current) {
          const oldTrack = localStreamRef.current.getVideoTracks()[0];
          localStreamRef.current.removeTrack(oldTrack);
          localStreamRef.current.addTrack(screenTrack);
        }

        // Update local video display
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        // Replace track for all peers
        peersRef.current.forEach(({ peer }) => {
          try {
            peer.removeStream(localStreamRef.current!);
            peer.addStream(screenStream);
          } catch (err) {
            console.error('Error updating peer stream:', err);
          }
        });

        // Handle screen share stop
        screenTrack.onended = () => {
          stopScreenShare();
        };

        setIsScreenSharing(true);
      } catch (err) {
        console.error('Error sharing screen:', err);
        alert('Screen sharing failed. Please try again.');
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

    // Get original camera stream
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((newStream) => {
        const videoTrack = newStream.getVideoTracks()[0];
        const audioTrack = newStream.getAudioTracks()[0];

        // Update local stream
        if (localStreamRef.current) {
          const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
          localStreamRef.current.removeTrack(oldVideoTrack);
          localStreamRef.current.addTrack(videoTrack);

          // Restore audio state
          audioTrack.enabled = isAudioEnabled;
        }

        // Update local video display
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = newStream;
        }

        // Update all peers
        peersRef.current.forEach(({ peer }) => {
          try {
            peer.removeStream(localStreamRef.current!);
            peer.addStream(newStream);
          } catch (err) {
            console.error('Error restoring peer stream:', err);
          }
        });

        localStreamRef.current = newStream;
        setIsScreenSharing(false);
      })
      .catch((err) => {
        console.error('Error restoring camera:', err);
        setIsScreenSharing(false);
      });
  };

  const leaveRoom = () => {
    window.location.href = `/event/${roomId}`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto p-4">
        <div className="mb-4 text-center">
          <h2 className="text-2xl font-bold">
            {isScreenSharing ? '🖥️ Sharing Screen' : '📹 Video Meeting'}
          </h2>
          <p className="text-gray-400 text-sm">
            {peers.length + 1} participant{peers.length !== 0 ? 's' : ''} in room
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-20">
          {/* Local video */}
          <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-3 py-1 rounded">
              {userName} (You)
            </div>
            {!isVideoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                <span className="text-6xl">👤</span>
              </div>
            )}
          </div>

          {/* Remote videos */}
          {peers.map((peer) => (
            <VideoCard key={peer.userId} peer={peer.peer} userName={peer.userName} />
          ))}
        </div>

        {/* Controls */}
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4">
          <div className="container mx-auto flex justify-center gap-4">
            <button
              onClick={toggleAudio}
              className={`p-4 rounded-full ${
                isAudioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
              } transition-colors`}
              title={isAudioEnabled ? 'Mute' : 'Unmute'}
            >
              <span className="text-2xl">{isAudioEnabled ? '🎤' : '🔇'}</span>
            </button>

            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full ${
                isVideoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
              } transition-colors`}
              title={isVideoEnabled ? 'Stop video' : 'Start video'}
            >
              <span className="text-2xl">{isVideoEnabled ? '📹' : '📵'}</span>
            </button>

            <button
              onClick={toggleScreenShare}
              className={`p-4 rounded-full ${
                isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
              } transition-colors`}
              title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            >
              <span className="text-2xl">🖥️</span>
            </button>

            <button
              onClick={leaveRoom}
              className="p-4 px-6 rounded-full bg-red-600 hover:bg-red-700 transition-colors font-semibold"
              title="Leave meeting"
            >
              Leave
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VideoCard({ peer, userName }: { peer: SimplePeer.Instance; userName: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(true);

  useEffect(() => {
    peer.on('stream', (stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Check if video track is enabled
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        setHasVideo(videoTrack.enabled);
        videoTrack.onended = () => setHasVideo(false);
      }
    });
  }, [peer]);

  return (
    <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-3 py-1 rounded">
        {userName}
      </div>
      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
          <span className="text-6xl">👤</span>
        </div>
      )}
    </div>
  );
}
