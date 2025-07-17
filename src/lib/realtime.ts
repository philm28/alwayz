import { io, Socket } from 'socket.io-client';
import Peer from 'simple-peer';

export interface RTCConfig {
  iceServers: RTCIceServer[];
}

export interface CallSession {
  id: string;
  personaId: string;
  type: 'video' | 'audio';
  status: 'connecting' | 'connected' | 'ended';
  startTime: Date;
  participants: string[];
}

export class RealtimeManager {
  private socket: Socket | null = null;
  private peer: Peer.Instance | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callSession: CallSession | null = null;

  private rtcConfig: RTCConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  constructor() {
    this.initializeSocket();
  }

  private initializeSocket() {
    // In production, this would connect to your WebSocket server
    this.socket = io(import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:3001', {
      transports: ['websocket']
    });

    this.socket.on('connect', () => {
      console.log('Connected to realtime server');
    });

    this.socket.on('call-offer', this.handleCallOffer.bind(this));
    this.socket.on('call-answer', this.handleCallAnswer.bind(this));
    this.socket.on('ice-candidate', this.handleIceCandidate.bind(this));
    this.socket.on('call-ended', this.handleCallEnded.bind(this));
  }

  async startCall(personaId: string, type: 'video' | 'audio'): Promise<CallSession> {
    try {
      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video',
        audio: true
      });

      // Create call session
      this.callSession = {
        id: `call-${Date.now()}`,
        personaId,
        type,
        status: 'connecting',
        startTime: new Date(),
        participants: ['user', personaId]
      };

      // Initialize peer connection
      this.peer = new Peer({
        initiator: true,
        trickle: false,
        stream: this.localStream,
        config: this.rtcConfig
      });

      this.setupPeerEvents();

      // Emit call offer
      this.socket?.emit('start-call', {
        sessionId: this.callSession.id,
        personaId,
        type
      });

      return this.callSession;
    } catch (error) {
      console.error('Error starting call:', error);
      throw new Error('Failed to start call');
    }
  }

  async answerCall(callData: any): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: callData.type === 'video',
        audio: true
      });

      this.peer = new Peer({
        initiator: false,
        trickle: false,
        stream: this.localStream,
        config: this.rtcConfig
      });

      this.setupPeerEvents();
      this.peer.signal(callData.offer);
    } catch (error) {
      console.error('Error answering call:', error);
      throw new Error('Failed to answer call');
    }
  }

  endCall(): void {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.callSession) {
      this.socket?.emit('end-call', { sessionId: this.callSession.id });
      this.callSession = null;
    }
  }

  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = enabled;
      }
    }
  }

  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = enabled;
      }
    }
  }

  private setupPeerEvents(): void {
    if (!this.peer) return;

    this.peer.on('signal', (data) => {
      this.socket?.emit('call-signal', {
        sessionId: this.callSession?.id,
        signal: data
      });
    });

    this.peer.on('stream', (stream) => {
      this.remoteStream = stream;
      this.onRemoteStream?.(stream);
    });

    this.peer.on('connect', () => {
      if (this.callSession) {
        this.callSession.status = 'connected';
      }
      this.onCallConnected?.();
    });

    this.peer.on('error', (error) => {
      console.error('Peer error:', error);
      this.onCallError?.(error);
    });
  }

  private handleCallOffer(data: any): void {
    this.onIncomingCall?.(data);
  }

  private handleCallAnswer(data: any): void {
    if (this.peer) {
      this.peer.signal(data.answer);
    }
  }

  private handleIceCandidate(data: any): void {
    if (this.peer) {
      this.peer.signal(data.candidate);
    }
  }

  private handleCallEnded(): void {
    this.endCall();
    this.onCallEnded?.();
  }

  // Event handlers (to be set by components)
  onIncomingCall?: (callData: any) => void;
  onCallConnected?: () => void;
  onCallEnded?: () => void;
  onCallError?: (error: any) => void;
  onRemoteStream?: (stream: MediaStream) => void;

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  getCallSession(): CallSession | null {
    return this.callSession;
  }
}

export const realtimeManager = new RealtimeManager();