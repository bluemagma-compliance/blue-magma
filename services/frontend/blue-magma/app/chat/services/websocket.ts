"use client";

export interface WebSocketMessage {
	type: "system" | "response" | "error" | "init" | "history";
  event?: "thought" | "message" | "status" | "update" | "redirect";
  message?: string;
  session_id?: string;
  timestamp?: string;
  // Initialization message fields
  user_id?: string;
  org_id?: string;
  project_id?: string;
  jwt_token?: string;
  entry_point?: string;
  resume_session_id?: string;
  // Thought / event message fields
  data?: {
    content?: string;
    node?: string;
    phase?: string;
    category?: string;
    timestamp?: string;
    session_id?: string;
    message?: string;
    update_type?: string;
    destination?: string;
    ui_actions?: UiAction[];
  };
	// Optional backfilled chat history sent on session ack
	messages?: {
		role: string;
		content: string;
		timestamp?: string;
	}[];
}

export interface ChatResponse {
  success: boolean;
  response?: string;
  intermediateSteps?: string[];
  creditsUsed?: number;
  memoryDebug?: unknown;
  error?: string;
  updateType?: string;
  uiActions?: UiAction[];
  thought?: {
    content: string;
    node?: string;
    phase?: string;
    category?: string;
    timestamp?: string;
  };
  redirect?: {
    destination: string;
    sessionId: string;
    timestamp?: string;
  };
	// Optional backfilled chat history when the server sends a
	// type: "history" acknowledgement message.
	history?: {
		role: string;
		content: string;
		timestamp?: string;
	}[];
}


export interface UiAction {
  scope?: string;
  target?: string;
  type: string;
  params?: Record<string, unknown>;
}

export interface WebSocketConfig {
  url: string;
  token?: string;
  orgId?: string;
  userId?: string;
  projectId?: string;
  entryPoint?: string;
  resumeSessionId?: string;
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export class ChatWebSocketService {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private messageHandlers: ((response: ChatResponse) => void)[] = [];
  private statusHandlers: ((status: ConnectionStatus) => void)[] = [];
  private sessionId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnected = false;
  private isInitialized = false;

  constructor(config: WebSocketConfig) {
    this.config = config;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Prevent double initialization in React StrictMode
        if (this.isInitialized) {
          console.log("WebSocket already initialized, skipping...");
          return resolve();
        }
        this.isInitialized = true;

        this.updateStatus("connecting");
        this.ws = new WebSocket(this.config.url);

        this.ws.onopen = () => {
          console.log("WebSocket connected to GraphLang Agent");
          this.isConnected = true;
          // Wait for welcome message, then send initialization
        };

        this.ws.onmessage = (event) => {
          try {
            const data: WebSocketMessage = JSON.parse(event.data);
            console.log("📨 [WebSocket] Raw message received:", event.data);
            console.log("📨 [WebSocket] Parsed message:", data);
            this.handleMessage(data, resolve, reject);
          } catch (error) {
            console.error("❌ [WebSocket] Failed to parse WebSocket message:", error);
            this.handleError("Failed to parse server message");
          }
        };

        this.ws.onclose = (event) => {
          console.log("WebSocket closed:", event.code, event.reason);
          this.isConnected = false;
          this.updateStatus("disconnected");

          // Attempt reconnection if not a clean close
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          this.updateStatus("error");
          this.handleError("Connection error occurred");
          reject(new Error("WebSocket connection failed"));
        };

      } catch (error) {
        console.error("Failed to create WebSocket:", error);
        reject(error);
      }
    });
  }



  private handleMessage(
    data: WebSocketMessage,
    connectResolve?: (value: void) => void,
    connectReject?: (reason?: unknown) => void
  ): void {
    // Log all events for debugging
    console.log("📡 [WebSocket] Received data event:", data.event, "type:", data.type);

    // Handle thought events first (they have event property instead of type)
    if (data.event === "thought" && data.data) {
      console.log("💭 [WebSocket] Processing thought event");
      this.notifyHandlers({
        success: true,
        thought: {
          content: data.data.content || "",
          node: data.data.node,
          phase: data.data.phase,
          category: data.data.category,
          timestamp: data.data.timestamp
        }
      });
      return;
    }

    // Handle update events - signal frontend to refresh data
    if (data.event === "update") {
      const updateType = data.data?.update_type || "unknown";
      const uiActions = data.data?.ui_actions;
      console.log("🔄 [WebSocket] Received update signal from backend, type:", updateType, "uiActions:", uiActions);
      this.notifyHandlers({
        success: true,
        response: "__UPDATE_SIGNAL__", // Special marker for update events
        updateType,
        uiActions,
        intermediateSteps: [],
        creditsUsed: 0,
        memoryDebug: null,
      });
      return;
    }

    // Handle redirect events - signal frontend to navigate
    if (data.event === "redirect") {
      const destination = data.data?.destination || "";
      const sessionId = data.data?.session_id || "";
      const timestamp = data.data?.timestamp;

      console.log("➡️ [WebSocket] Received redirect event:", {
        destination,
        sessionId,
        timestamp,
      });

      this.notifyHandlers({
        success: true,
        redirect: {
          destination,
          sessionId,
          timestamp,
        },
        intermediateSteps: [],
        creditsUsed: 0,
        memoryDebug: null,
      });
      return;
    }

    switch (data.type) {
      case "system":
        if (data.message?.includes("Connected to GraphLang Agent")) {
          // GraphLang Agent welcome message - send initialization
          this.sessionId = data.session_id || null;
          console.log("Connected to GraphLang Agent, session ID:", this.sessionId);

          // Send initialization message
          this.sendInitialization()
            .then(() => {
              this.updateStatus("connected");
              this.reconnectAttempts = 0;
              connectResolve?.();
            })
            .catch((error) => {
              console.error("Failed to send initialization:", error);
              this.updateStatus("error");
              connectReject?.(error);
            });
        } else if (data.message?.includes("Session initialized successfully")) {
          // Initialization acknowledged
          console.log("Session initialization acknowledged");
        } else {
          // Handle other system messages
          this.notifyHandlers({
            success: true,
            response: data.message || "",
            intermediateSteps: [],
            creditsUsed: 0,
            memoryDebug: null
          });
        }
        break;

      case "response":
        this.notifyHandlers({
          success: true,
          response: data.message,
          intermediateSteps: [],
          creditsUsed: 0,
          memoryDebug: null
        });
        break;

		      case "history": {
		        // Session initialization with optional backfilled chat history.
		        if (data.session_id) {
		          this.sessionId = data.session_id || null;
		          console.log("Session history received for session ID:", this.sessionId);
		        }

		        const history = (data.messages ?? []).map((msg) => ({
		          role: msg.role,
		          content: msg.content,
		          timestamp: msg.timestamp,
		        }));

		        this.notifyHandlers({
		          success: true,
		          history,
		          intermediateSteps: [],
		          creditsUsed: 0,
		          memoryDebug: null,
		        });
		        break;
		      }

      case "error":
        this.notifyHandlers({
          success: false,
          error: data.message,
          intermediateSteps: [],
          creditsUsed: 0,
          memoryDebug: null
        });
        break;

		  default:
		    console.warn("Unknown message type:", data.type);
		    console.warn("Full message data:", data);
		}
  }

  private handleError(error: string): void {
    this.notifyHandlers({
      success: false,
      error,
      intermediateSteps: [],
      creditsUsed: 0,
      memoryDebug: null
    });
  }

  private attemptReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      this.connect().catch(error => {
        console.error("Reconnection failed:", error);
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.updateStatus("error");
          this.handleError("Failed to reconnect after multiple attempts");
        }
      });
    }, delay);
  }

  private async sendInitialization(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }

    // Import here to avoid circular dependency
    const { getInitializationData } = await import("../actions");

    try {
      const result = await getInitializationData();
      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to get initialization data");
      }

      const initMessage: WebSocketMessage = {
        type: "init",
        user_id: result.data.userId,
        org_id: result.data.orgId,
        project_id: this.config.projectId,
        jwt_token: result.data.jwtToken,
        entry_point: this.config.entryPoint,
        resume_session_id: this.config.resumeSessionId,
        timestamp: new Date().toISOString(),
      };

      console.log("Sending initialization message:", {
        type: initMessage.type,
        user_id: initMessage.user_id,
        org_id: initMessage.org_id,
        project_id: initMessage.project_id,
        jwt_token: initMessage.jwt_token ? "[REDACTED]" : undefined
      });

      this.ws.send(JSON.stringify(initMessage));
    } catch (error) {
      console.error("Failed to send initialization:", error);
      throw error;
    }
  }

  sendMessage(message: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isConnected) {
        reject(new Error("WebSocket not connected"));
        return;
      }

      try {
        // GraphLang Agent expects simple message format for chat
        const messageData = { message };
        this.ws.send(JSON.stringify(messageData));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  sendFrontendEvent(eventName: string, payload: Record<string, unknown> = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isConnected) {
        reject(new Error("WebSocket not connected"));
        return;
      }

      try {
        const messageData = {
          type: "frontend_event",
          event: eventName,
          payload,
        };
        console.log("📤 [WebSocket] Sending frontend_event:", messageData);
        this.ws.send(JSON.stringify(messageData));
        resolve();
      } catch (error) {
        console.error("❌ [WebSocket] Failed to send frontend_event:", error);
        reject(error);
      }
    });
  }

  onMessage(handler: (response: ChatResponse) => void): () => void {
    this.messageHandlers.push(handler);
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }

  onStatusChange(handler: (status: ConnectionStatus) => void): () => void {
    this.statusHandlers.push(handler);
    return () => {
      const index = this.statusHandlers.indexOf(handler);
      if (index > -1) {
        this.statusHandlers.splice(index, 1);
      }
    };
  }

  private notifyHandlers(response: ChatResponse): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(response);
      } catch (error) {
        console.error("Error in message handler:", error);
      }
    });
  }

  private updateStatus(status: ConnectionStatus): void {
    this.statusHandlers.forEach(handler => {
      try {
        handler(status);
      } catch (error) {
        console.error("Error in status handler:", error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
    this.isConnected = false;
    this.isInitialized = false;
    this.sessionId = null;
    this.reconnectAttempts = 0;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getConnectionStatus(): ConnectionStatus {
    if (!this.ws) return "disconnected";

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return "connecting";
      case WebSocket.OPEN:
        return this.isConnected ? "connected" : "connecting";
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return "disconnected";
      default:
        return "error";
    }
  }
}
