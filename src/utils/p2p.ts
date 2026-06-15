import type { PeerMessage } from "../types";

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const createId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `peer-${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface SignalCode {
  type: RTCSdpType;
  sdp: string;
}

const encodeSignal = (description: RTCSessionDescriptionInit) => {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ type: description.type, sdp: description.sdp ?? "" } satisfies SignalCode),
  );
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const decodeSignal = (code: string): RTCSessionDescriptionInit => {
  const binary = atob(code.trim().replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const value = JSON.parse(new TextDecoder().decode(bytes)) as SignalCode;
  if (!value.type || !value.sdp) throw new Error("Ungültiger Verbindungscode.");
  return value;
};

const waitForIce = (connection: RTCPeerConnection) =>
  new Promise<void>((resolve) => {
    if (connection.iceGatheringState === "complete") {
      resolve();
      return;
    }

    const timeout = window.setTimeout(() => {
      connection.removeEventListener("icegatheringstatechange", handleState);
      resolve();
    }, 10000);
    const handleState = () => {
      if (connection.iceGatheringState === "complete") {
        window.clearTimeout(timeout);
        connection.removeEventListener("icegatheringstatechange", handleState);
        resolve();
      }
    };
    connection.addEventListener("icegatheringstatechange", handleState);
  });

export interface PeerInfo {
  id: string;
  status: RTCPeerConnectionState;
}

export class P2PNetwork {
  private connections = new Map<string, RTCPeerConnection>();
  private channels = new Map<string, RTCDataChannel>();
  private messageHandler: (message: PeerMessage, peerId: string) => void = () => undefined;
  private statusHandler: (peers: PeerInfo[]) => void = () => undefined;

  onMessage(handler: (message: PeerMessage, peerId: string) => void) {
    this.messageHandler = handler;
  }

  onStatus(handler: (peers: PeerInfo[]) => void) {
    this.statusHandler = handler;
  }

  async createHostOffer() {
    const peerId = createId();
    const connection = this.createConnection(peerId);
    const channel = connection.createDataChannel("erebopoly", { ordered: true });
    this.registerChannel(peerId, channel);
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    await waitForIce(connection);
    return { peerId, code: encodeSignal(connection.localDescription!) };
  }

  async acceptHostAnswer(peerId: string, code: string) {
    const connection = this.connections.get(peerId);
    if (!connection) throw new Error("Diese Einladung ist nicht mehr aktiv.");
    await connection.setRemoteDescription(decodeSignal(code));
  }

  async createGuestAnswer(offerCode: string) {
    const peerId = "host";
    const connection = this.createConnection(peerId);
    connection.ondatachannel = (event) => this.registerChannel(peerId, event.channel);
    await connection.setRemoteDescription(decodeSignal(offerCode));
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    await waitForIce(connection);
    return encodeSignal(connection.localDescription!);
  }

  send(peerId: string, message: PeerMessage) {
    const channel = this.channels.get(peerId);
    if (channel?.readyState !== "open") return false;
    channel.send(JSON.stringify(message));
    return true;
  }

  broadcast(message: PeerMessage) {
    this.channels.forEach((channel) => {
      if (channel.readyState === "open") channel.send(JSON.stringify(message));
    });
  }

  connectedPeerIds() {
    return [...this.channels.entries()]
      .filter(([, channel]) => channel.readyState === "open")
      .map(([id]) => id);
  }

  close() {
    this.channels.forEach((channel) => channel.close());
    this.connections.forEach((connection) => connection.close());
    this.channels.clear();
    this.connections.clear();
    this.emitStatus();
  }

  private createConnection(peerId: string) {
    const connection = new RTCPeerConnection(rtcConfig);
    this.connections.set(peerId, connection);
    connection.onconnectionstatechange = () => this.emitStatus();
    this.emitStatus();
    return connection;
  }

  private registerChannel(peerId: string, channel: RTCDataChannel) {
    this.channels.set(peerId, channel);
    channel.onopen = () => this.emitStatus();
    channel.onclose = () => this.emitStatus();
    channel.onerror = () => this.emitStatus();
    channel.onmessage = (event) => {
      try {
        this.messageHandler(JSON.parse(event.data as string) as PeerMessage, peerId);
      } catch {
        this.send(peerId, { type: "error", message: "Eine Netzwerknachricht war ungültig." });
      }
    };
  }

  private emitStatus() {
    this.statusHandler(
      [...this.connections.entries()].map(([id, connection]) => ({
        id,
        status: connection.connectionState,
      })),
    );
  }
}
