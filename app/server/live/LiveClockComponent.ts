// 🔥 LiveClock - Real-time Clock Live Component
// Automatically updates every second and broadcasts to all connected clients
import { LiveComponent } from "@core/types/types";

interface LiveClockState {
  currentTime: string; // Formatted time string
  timeZone: string; // IANA timezone (e.g., 'America/Sao_Paulo')
  format: '12h' | '24h'; // Time format preference
  showSeconds: boolean; // Toggle seconds display
  showDate: boolean; // Toggle date display
  lastSync: Date; // Last sync timestamp
  serverUptime: number; // Server uptime in seconds
}

export class LiveClockComponent extends LiveComponent<LiveClockState> {
  private clockInterval: NodeJS.Timeout | null = null;
  private startTime: Date;

  constructor(initialState: Partial<LiveClockState>, ws: any, options?: { room?: string; userId?: string }) {
    const now = new Date();
    const defaults: LiveClockState = {
      currentTime: now.toLocaleTimeString('pt-BR'),
      timeZone: 'America/Sao_Paulo',
      format: '24h',
      showSeconds: true,
      showDate: true,
      lastSync: now,
      serverUptime: 0,
    };
    super({ ...defaults, ...initialState }, ws, options);
    
    this.startTime = now;
    console.log(`🕐 ${this.constructor.name} created: ${this.id}`);
    
    // Start the real-time clock immediately
    this.startClock();
  }

  private startClock() {
    // Clear any existing interval
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }

    // Update clock every second
    this.clockInterval = setInterval(() => {
      this.updateClock();
    }, 1000);

    // Initial update
    this.updateClock();
  }

  private updateClock() {
    const now = new Date();
    const uptimeMs = now.getTime() - this.startTime.getTime();
    
    let timeString;
    if (this.state.format === '12h') {
      timeString = now.toLocaleTimeString('en-US', {
        hour12: true,
        hour: 'numeric',
        minute: '2-digit',
        second: this.state.showSeconds ? '2-digit' : undefined
      });
    } else {
      timeString = now.toLocaleTimeString('pt-BR', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: this.state.showSeconds ? '2-digit' : undefined
      });
    }

    this.setState({
      currentTime: timeString,
      lastSync: now,
      serverUptime: Math.floor(uptimeMs / 1000)
    });

    // Broadcast time update to all connected clients
    if (this.room) {
      this.broadcast('CLOCK_TICK', {
        currentTime: timeString,
        timestamp: now.toISOString(),
        serverUptime: Math.floor(uptimeMs / 1000)
      });
    }
  }

  async setTimeFormat(payload: { format: '12h' | '24h' }) {
    const { format } = payload;
    
    if (format !== '12h' && format !== '24h') {
      throw new Error('Invalid time format. Use "12h" or "24h"');
    }

    this.setState({ 
      format,
      lastSync: new Date()
    });

    // Immediately update the clock display with new format
    this.updateClock();

    console.log(`🕐 Time format changed to: ${format}`);
    return { success: true, format };
  }

  async toggleSeconds(payload?: { showSeconds?: boolean }) {
    const showSeconds = payload?.showSeconds ?? !this.state.showSeconds;
    
    this.setState({ 
      showSeconds,
      lastSync: new Date()
    });

    // Update clock display immediately
    this.updateClock();

    console.log(`🕐 Seconds display: ${showSeconds ? 'ON' : 'OFF'}`);
    return { success: true, showSeconds };
  }

  async toggleDate(payload?: { showDate?: boolean }) {
    const showDate = payload?.showDate ?? !this.state.showDate;
    
    this.setState({ 
      showDate,
      lastSync: new Date()
    });

    console.log(`🕐 Date display: ${showDate ? 'ON' : 'OFF'}`);
    return { success: true, showDate };
  }

  async setTimeZone(payload: { timeZone: string }) {
    const { timeZone } = payload;
    
    // Basic timezone validation
    try {
      new Date().toLocaleString('en-US', { timeZone });
    } catch (error) {
      throw new Error(`Invalid timezone: ${timeZone}`);
    }

    this.setState({ 
      timeZone,
      lastSync: new Date()
    });

    console.log(`🕐 Timezone changed to: ${timeZone}`);
    return { success: true, timeZone };
  }

  async getServerInfo() {
    console.log(`🕐 getServerInfo called for component: ${this.id}`);
    
    const now = new Date();
    const uptimeMs = now.getTime() - this.startTime.getTime();
    
    const result = {
      success: true,
      info: {
        serverTime: now.toISOString(),
        localTime: now.toLocaleString('pt-BR'),
        uptime: Math.floor(uptimeMs / 1000),
        uptimeFormatted: this.formatUptime(Math.floor(uptimeMs / 1000)),
        timezone: this.state.timeZone,
        componentId: this.id,
        startTime: this.startTime.toISOString()
      }
    };
    
    console.log(`🕐 getServerInfo result:`, result);
    return result;
  }

  async syncTime() {
    // Force a manual time sync
    this.updateClock();
    
    console.log(`🕐 Manual time sync performed`);
    return { 
      success: true, 
      syncTime: new Date().toISOString(),
      currentTime: this.state.currentTime
    };
  }

  private formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  public destroy() {
    // Clean up the interval when component is destroyed
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
      console.log(`🕐 Clock interval cleared for component: ${this.id}`);
    }
    
    super.destroy();
  }
}