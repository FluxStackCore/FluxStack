import type { CliCommand } from "@core/plugins/types";
import { promises as fs } from "fs";
import path from "path";

// Component templates for different types
const getServerTemplate = (componentName: string, type: string, room?: string) => {
  const roomComment = room ? `\n    // Default room: ${room}` : '';
  const roomInit = room ? `\n      this.room = '${room}';` : '';

  switch (type) {
    case 'counter':
      return `// 🔥 ${componentName} - Counter Live Component
import { LiveComponent } from "@core/types/types";

interface ${componentName}State {
  count: number;
  title: string;
  step: number;
  lastUpdated: Date;
}

export class ${componentName}Component extends LiveComponent<${componentName}State> {
  constructor(initialState: ${componentName}State, ws: any, options?: { room?: string; userId?: string }) {
    super({
      count: 0,
      title: "${componentName} Counter",
      step: 1,
      lastUpdated: new Date(),
      ...initialState
    }, ws, options);${roomComment}${roomInit}
    
    console.log(\`🔢 \${this.constructor.name} component created: \${this.id}\`);
  }

  async increment(amount: number = this.state.step) {
    const newCount = this.state.count + amount;
    
    this.setState({
      count: newCount,
      lastUpdated: new Date()
    });
    
    // Broadcast to room for multi-user sync
    if (this.room) {
      this.broadcast('COUNTER_INCREMENTED', {
        count: newCount,
        amount,
        userId: this.userId
      });
    }
    
    console.log(\`🔢 Counter incremented to \${newCount} (step: \${amount})\`);
    return { success: true, count: newCount };
  }

  async decrement(amount: number = this.state.step) {
    const newCount = Math.max(0, this.state.count - amount);
    
    this.setState({
      count: newCount,
      lastUpdated: new Date()
    });
    
    if (this.room) {
      this.broadcast('COUNTER_DECREMENTED', {
        count: newCount,
        amount,
        userId: this.userId
      });
    }
    
    console.log(\`🔢 Counter decremented to \${newCount} (step: \${amount})\`);
    return { success: true, count: newCount };
  }

  async reset() {
    this.setState({
      count: 0,
      lastUpdated: new Date()
    });
    
    if (this.room) {
      this.broadcast('COUNTER_RESET', { userId: this.userId });
    }
    
    console.log(\`🔢 Counter reset\`);
    return { success: true, count: 0 };
  }

  async setStep(step: number) {
    this.setState({
      step: Math.max(1, step),
      lastUpdated: new Date()
    });
    
    return { success: true, step };
  }

  async updateTitle(data: { title: string }) {
    const newTitle = data.title.trim();
    
    if (!newTitle || newTitle.length > 50) {
      throw new Error('Title must be 1-50 characters');
    }
    
    this.setState({
      title: newTitle,
      lastUpdated: new Date()
    });
    
    return { success: true, title: newTitle };
  }
}`;

    case 'form':
      return `// 🔥 ${componentName} - Form Live Component
import { LiveComponent } from "@core/types/types";

interface ${componentName}State {
  formData: Record<string, any>;
  errors: Record<string, string>;
  isSubmitting: boolean;
  isValid: boolean;
  lastUpdated: Date;
}

export class ${componentName}Component extends LiveComponent<${componentName}State> {
  constructor(initialState: ${componentName}State, ws: any, options?: { room?: string; userId?: string }) {
    super({
      formData: {},
      errors: {},
      isSubmitting: false,
      isValid: false,
      lastUpdated: new Date(),
      ...initialState
    }, ws, options);${roomComment}${roomInit}
    
    console.log(\`📝 \${this.constructor.name} component created: \${this.id}\`);
  }

  async updateField(data: { field: string; value: any }) {
    const { field, value } = data;
    const newFormData = { ...this.state.formData, [field]: value };
    const newErrors = { ...this.state.errors };
    
    // Clear error for this field
    delete newErrors[field];
    
    // Basic validation example
    if (field === 'email' && value && !this.isValidEmail(value)) {
      newErrors[field] = 'Invalid email format';
    }
    
    this.setState({
      formData: newFormData,
      errors: newErrors,
      isValid: Object.keys(newErrors).length === 0,
      lastUpdated: new Date()
    });
    
    return { success: true, field, value };
  }

  async submitForm() {
    this.setState({ isSubmitting: true });
    
    try {
      // Simulate form submission
      await this.sleep(1000);
      
      // Validate all fields
      const errors = this.validateForm(this.state.formData);
      
      if (Object.keys(errors).length > 0) {
        this.setState({
          errors,
          isSubmitting: false,
          isValid: false
        });
        return { success: false, errors };
      }
      
      // Success
      this.setState({
        isSubmitting: false,
        errors: {},
        isValid: true,
        lastUpdated: new Date()
      });
      
      if (this.room) {
        this.broadcast('FORM_SUBMITTED', {
          formData: this.state.formData,
          userId: this.userId
        });
      }
      
      console.log(\`📝 Form submitted successfully\`);
      return { success: true, data: this.state.formData };
      
    } catch (error: any) {
      this.setState({ isSubmitting: false });
      throw error;
    }
  }

  async resetForm() {
    this.setState({
      formData: {},
      errors: {},
      isSubmitting: false,
      isValid: false,
      lastUpdated: new Date()
    });
    
    return { success: true };
  }

  private validateForm(data: Record<string, any>): Record<string, string> {
    const errors: Record<string, string> = {};
    
    // Add your validation rules here
    if (!data.name || data.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }
    
    if (!data.email || !this.isValidEmail(data.email)) {
      errors.email = 'Valid email is required';
    }
    
    return errors;
  }

  private isValidEmail(email: string): boolean {
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}`;

    case 'chat':
      return `// 🔥 ${componentName} - Chat Live Component
import { LiveComponent } from "@core/types/types";

interface Message {
  id: string;
  text: string;
  userId: string;
  username: string;
  timestamp: Date;
}

interface ${componentName}State {
  messages: Message[];
  users: Record<string, { username: string; isOnline: boolean }>;
  currentMessage: string;
  isTyping: Record<string, boolean>;
  lastUpdated: Date;
}

export class ${componentName}Component extends LiveComponent<${componentName}State> {
  constructor(initialState: ${componentName}State, ws: any, options?: { room?: string; userId?: string }) {
    super({
      messages: [],
      users: {},
      currentMessage: "",
      isTyping: {},
      lastUpdated: new Date(),
      ...initialState
    }, ws, options);${roomComment}${roomInit}
    
    console.log(\`💬 \${this.constructor.name} component created: \${this.id}\`);
    
    // Add user to online users
    if (this.userId) {
      this.addUser(this.userId, \`User \${this.userId.slice(-4)}\`);
    }
  }

  async sendMessage(data: { text: string; username?: string }) {
    const { text, username = \`User \${this.userId?.slice(-4) || 'Anonymous'}\` } = data;
    
    if (!text.trim()) {
      throw new Error('Message cannot be empty');
    }
    
    const message: Message = {
      id: \`msg-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`,
      text: text.trim(),
      userId: this.userId || 'anonymous',
      username,
      timestamp: new Date()
    };
    
    const newMessages = [...this.state.messages, message];
    
    this.setState({
      messages: newMessages.slice(-50), // Keep last 50 messages
      currentMessage: "",
      lastUpdated: new Date()
    });
    
    // Broadcast to all users in the room
    if (this.room) {
      this.broadcast('NEW_MESSAGE', {
        message,
        totalMessages: newMessages.length
      });
    }
    
    console.log(\`💬 Message sent: "\${text}" by \${username}\`);
    return { success: true, message };
  }

  async updateTyping(data: { isTyping: boolean; username?: string }) {
    const { isTyping, username = \`User \${this.userId?.slice(-4)}\` } = data;
    const userId = this.userId || 'anonymous';
    
    const newTyping = { ...this.state.isTyping };
    
    if (isTyping) {
      newTyping[userId] = true;
    } else {
      delete newTyping[userId];
    }
    
    this.setState({
      isTyping: newTyping,
      lastUpdated: new Date()
    });
    
    // Broadcast typing status
    if (this.room) {
      this.broadcast('USER_TYPING', {
        userId,
        username,
        isTyping
      });
    }
    
    // Auto-clear typing after 3 seconds
    if (isTyping) {
      setTimeout(() => {
        this.updateTyping({ isTyping: false, username });
      }, 3000);
    }
    
    return { success: true };
  }

  async joinRoom(data: { username: string }) {
    const { username } = data;
    
    this.addUser(this.userId || 'anonymous', username);
    
    if (this.room) {
      this.broadcast('USER_JOINED', {
        userId: this.userId,
        username,
        timestamp: new Date()
      });
    }
    
    return { success: true, username };
  }

  async leaveRoom() {
    const userId = this.userId || 'anonymous';
    const users = { ...this.state.users };
    delete users[userId];
    
    this.setState({
      users,
      lastUpdated: new Date()
    });
    
    if (this.room) {
      this.broadcast('USER_LEFT', {
        userId,
        timestamp: new Date()
      });
    }
    
    return { success: true };
  }

  private addUser(userId: string, username: string) {
    const users = {
      ...this.state.users,
      [userId]: { username, isOnline: true }
    };
    
    this.setState({
      users,
      lastUpdated: new Date()
    });
  }

  public destroy() {
    this.leaveRoom();
    super.destroy();
  }
}`;

    default: // basic
      return `// 🔥 ${componentName} - Live Component
import { LiveComponent } from "@core/types/types";

interface ${componentName}State {
  message: string;
  count: number;
  lastUpdated: Date;
}

export class ${componentName}Component extends LiveComponent<${componentName}State> {
  constructor(initialState: ${componentName}State, ws: any, options?: { room?: string; userId?: string }) {
    super({
      message: "Hello from ${componentName}!",
      count: 0,
      lastUpdated: new Date(),
      ...initialState
    }, ws, options);${roomComment}${roomInit}
    
    console.log(\`🔥 \${this.constructor.name} component created: \${this.id}\`);
  }

  async updateMessage(payload: { message: string }) {
    const { message } = payload;
    
    if (!message || message.trim().length === 0) {
      throw new Error('Message cannot be empty');
    }
    
    this.setState({
      message: message.trim(),
      lastUpdated: new Date()
    });
    
    // Broadcast to room if in multi-user mode
    if (this.room) {
      this.broadcast('MESSAGE_UPDATED', {
        message: message.trim(),
        userId: this.userId
      });
    }
    
    console.log(\`📝 Message updated: "\${message}"\`);
    return { success: true, message: message.trim() };
  }

  async incrementCounter() {
    const newCount = this.state.count + 1;
    
    this.setState({
      count: newCount,
      lastUpdated: new Date()
    });
    
    if (this.room) {
      this.broadcast('COUNTER_INCREMENTED', {
        count: newCount,
        userId: this.userId
      });
    }
    
    return { success: true, count: newCount };
  }

  async resetData() {
    this.setState({
      message: "Hello from ${componentName}!",
      count: 0,
      lastUpdated: new Date()
    });
    
    return { success: true };
  }

  async getData() {
    return {
      success: true,
      data: {
        ...this.state,
        componentId: this.id,
        room: this.room,
        userId: this.userId
      }
    };
  }
}`;
  }
};

const getClientTemplate = (componentName: string, type: string, room?: string) => {
  const roomProps = room ? `, { room: '${room}' }` : '';

  switch (type) {
    case 'counter':
      return `// 🔥 ${componentName} - Counter Client Component
import { useTypedLiveComponent } from '@core/client';
import type { InferComponentState } from '@core/client';

// Import component type DIRECTLY from backend - full type inference!
import type { ${componentName}Component } from '@/server/live/${componentName}Component';

// State type inferred from backend component
type ${componentName}State = InferComponentState<${componentName}Component>;

const initialState: ${componentName}State = {
  count: 0,
  title: "${componentName} Counter",
  step: 1,
  lastUpdated: new Date(),
};

export function ${componentName}() {
  const { state, call, connected, loading } = useTypedLiveComponent<${componentName}Component>('${componentName}', initialState${roomProps});

  if (!connected) {
    return (
      <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-600">Connecting to ${componentName}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 m-4 relative">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">{state.title}</h2>
        <span className={
          \`px-2 py-1 rounded-full text-xs font-medium \${
            connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }\`
        }>
          {connected ? '🟢 Connected' : '🔴 Disconnected'}
        </span>
      </div>
      
      <div className="text-center mb-6">
        <div className="text-6xl font-bold text-blue-600 mb-2">{state.count}</div>
        <p className="text-gray-600">Current Count</p>
      </div>
      
      <div className="flex gap-2 justify-center mb-4">
        <button
          onClick={() => call('decrement', {})}
          disabled={loading || state.count <= 0}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ➖ Decrement
        </button>

        <button
          onClick={() => call('increment', {})}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ➕ Increment
        </button>

        <button
          onClick={() => call('reset', {})}
          disabled={loading}
          className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          🔄 Reset
        </button>
      </div>
      
      <div className="border-t pt-4">
        <div className="flex gap-2 items-center mb-2">
          <label className="text-sm font-medium text-gray-700">Step Size:</label>
          <input
            type="number"
            min="1"
            max="10"
            value={state.step}
            onChange={(e) => call('setStep', parseInt(e.target.value) || 1)}
            className="w-20 px-2 py-1 border rounded"
            disabled={loading}
          />
        </div>
        
        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium text-gray-700">Title:</label>
          <input
            type="text"
            value={state.title}
            onChange={(e) => call('updateTitle', { title: e.target.value })}
            className="flex-1 px-2 py-1 border rounded"
            disabled={loading}
            maxLength={50}
          />
        </div>
      </div>
      
      <div className="mt-4 text-xs text-gray-500 text-center">
        Last updated: {new Date(state.lastUpdated).toLocaleTimeString()}
      </div>
      
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      )}
    </div>
  );
}`;

    case 'form':
      return `// 🔥 ${componentName} - Form Client Component
import { useTypedLiveComponent } from '@core/client';
import type { InferComponentState } from '@core/client';

// Import component type DIRECTLY from backend - full type inference!
import type { ${componentName}Component } from '@/server/live/${componentName}Component';

// State type inferred from backend component
type ${componentName}State = InferComponentState<${componentName}Component>;

const initialState: ${componentName}State = {
  formData: {},
  errors: {},
  isSubmitting: false,
  isValid: false,
  lastUpdated: new Date(),
};

export function ${componentName}() {
  const { state, call, connected, loading } = useTypedLiveComponent<${componentName}Component>('${componentName}', initialState${roomProps});

  if (!connected) {
    return (
      <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-600">Connecting to ${componentName}...</p>
        </div>
      </div>
    );
  }

  const handleFieldChange = (field: string, value: any) => {
    call('updateField', { field, value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await call('submitForm', {});
      if (result?.success) {
        alert('Form submitted successfully!');
      }
    } catch (error) {
      console.error('Submit error:', error);
    }
  };

  const handleReset = () => {
    call('resetForm', {});
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 m-4 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">${componentName} Form</h2>
        <span className={
          \`px-2 py-1 rounded-full text-xs font-medium \${
            connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }\`
        }>
          {connected ? '🟢 Connected' : '🔴 Disconnected'}
        </span>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name *
          </label>
          <input
            type="text"
            value={state.formData.name || ''}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            className={\`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 \${
              state.errors.name ? 'border-red-500' : 'border-gray-300'
            }\`}
            disabled={loading || state.isSubmitting}
            placeholder="Enter your name"
          />
          {state.errors.name && (
            <p className="text-red-500 text-xs mt-1">{state.errors.name}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email *
          </label>
          <input
            type="email"
            value={state.formData.email || ''}
            onChange={(e) => handleFieldChange('email', e.target.value)}
            className={\`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 \${
              state.errors.email ? 'border-red-500' : 'border-gray-300'
            }\`}
            disabled={loading || state.isSubmitting}
            placeholder="Enter your email"
          />
          {state.errors.email && (
            <p className="text-red-500 text-xs mt-1">{state.errors.email}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Message
          </label>
          <textarea
            value={state.formData.message || ''}
            onChange={(e) => handleFieldChange('message', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading || state.isSubmitting}
            placeholder="Enter your message"
            rows={3}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || state.isSubmitting || !state.isValid}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {state.isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Submitting...
              </>
            ) : (
              '📤 Submit'
            )}
          </button>
          
          <button
            type="button"
            onClick={handleReset}
            disabled={loading || state.isSubmitting}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🔄 Reset
          </button>
        </div>
      </form>
      
      <div className="mt-4 text-xs text-gray-500 text-center">
        Last updated: {new Date(state.lastUpdated).toLocaleTimeString()}
      </div>
    </div>
  );
}`;

    case 'chat':
      return `// 🔥 ${componentName} - Chat Client Component
import React, { useState, useEffect, useRef } from 'react';
import { useTypedLiveComponent } from '@core/client';
import type { InferComponentState } from '@core/client';

// Import component type DIRECTLY from backend - full type inference!
import type { ${componentName}Component } from '@/server/live/${componentName}Component';

// State type inferred from backend component
type ${componentName}State = InferComponentState<${componentName}Component>;

const initialState: ${componentName}State = {
  messages: [],
  users: {},
  currentMessage: "",
  isTyping: {},
  lastUpdated: new Date(),
};

export function ${componentName}() {
  const { state, call, connected, loading } = useTypedLiveComponent<${componentName}Component>('${componentName}', initialState${roomProps});
  const [username, setUsername] = useState(\`User\${Math.random().toString(36).substr(2, 4)}\`);
  const [hasJoined, setHasJoined] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state.messages]);

  if (!connected) {
    return (
      <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-600">Connecting to ${componentName}...</p>
        </div>
      </div>
    );
  }

  if (!hasJoined) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 m-4 max-w-md mx-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Join ${componentName}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your username"
              maxLength={20}
            />
          </div>
          <button
            onClick={async () => {
              if (username.trim()) {
                await call('joinRoom', { username: username.trim() });
                setHasJoined(true);
              }
            }}
            disabled={!username.trim() || loading}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            💬 Join Chat
          </button>
        </div>
      </div>
    );
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.currentMessage.trim()) {
      await call('sendMessage', { text: state.currentMessage, username });
    }
  };

  const typingUsers = Object.keys(state.isTyping).filter(userId => state.isTyping[userId]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm m-4 max-w-2xl mx-auto flex flex-col h-96">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-800">${componentName}</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {Object.keys(state.users).length} online
          </span>
          <span className={
            \`px-2 py-1 rounded-full text-xs font-medium \${
              connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }\`
          }>
            {connected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {state.messages.map((message) => (
          <div
            key={message.id}
            className={\`flex \${message.username === username ? 'justify-end' : 'justify-start'}\`}
          >
            <div
              className={\`max-w-xs px-3 py-2 rounded-lg \${
                message.username === username
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-800'
              }\`}
            >
              {message.username !== username && (
                <div className="text-xs font-medium mb-1">{message.username}</div>
              )}
              <div className="text-sm">{message.text}</div>
              <div className={\`text-xs mt-1 \${
                message.username === username ? 'text-blue-100' : 'text-gray-500'
              }\`}>
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        
        {typingUsers.length > 0 && (
          <div className="text-xs text-gray-500 italic">
            {typingUsers.map(userId => state.users[userId]?.username || userId).join(', ')} 
            {typingUsers.length === 1 ? ' is' : ' are'} typing...
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={state.currentMessage}
            onChange={(e) => {
              call('updateField', { field: 'currentMessage', value: e.target.value });
              call('updateTyping', { isTyping: e.target.value.length > 0, username });
            }}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Type a message..."
            disabled={loading}
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!state.currentMessage.trim() || loading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📤
          </button>
        </div>
      </form>
    </div>
  );
}`;

    default: // basic
      return `// 🔥 ${componentName} - Client Component
import { useTypedLiveComponent } from '@core/client';
import type { InferComponentState } from '@core/client';

// Import component type DIRECTLY from backend - full type inference!
import type { ${componentName}Component } from '@/server/live/${componentName}Component';

// State type inferred from backend component
type ${componentName}State = InferComponentState<${componentName}Component>;

const initialState: ${componentName}State = {
  message: "Loading...",
  count: 0,
  lastUpdated: new Date(),
};

export function ${componentName}() {
  const { state, call, connected, loading } = useTypedLiveComponent<${componentName}Component>('${componentName}', initialState${roomProps});

  if (!connected) {
    return (
      <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-600">Connecting to ${componentName}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 m-4 relative">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">${componentName} Live Component</h2>
        <span className={
          \`px-2 py-1 rounded-full text-xs font-medium \${
            connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }\`
        }>
          {connected ? '🟢 Connected' : '🔴 Disconnected'}
        </span>
      </div>
      
      <div className="space-y-4">
        <div>
          <p className="text-gray-600 mb-2">Server message:</p>
          <p className="text-lg font-semibold text-blue-600">{state.message}</p>
        </div>
        
        <div>
          <p className="text-gray-600 mb-2">Counter: <span className="font-bold text-2xl">{state.count}</span></p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => call('updateMessage', { message: 'Hello from the client!' })}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📝 Update Message
          </button>
          
          <button
            onClick={() => call('incrementCounter', {})}
            disabled={loading}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ➕ Increment
          </button>

          <button
            onClick={() => call('resetData', {})}
            disabled={loading}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🔄 Reset
          </button>

          <button
            onClick={async () => {
              const result = await call('getData', {});
              console.log('Component data:', result);
              alert('Data logged to console');
            }}
            disabled={loading}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📊 Get Data
          </button>
        </div>
      </div>
      
      <div className="mt-4 text-xs text-gray-500 text-center">
        Last updated: {new Date(state.lastUpdated).toLocaleTimeString()}
      </div>
      
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      )}
    </div>
  );
}`;
  }
};

export const createLiveComponentCommand: CliCommand = {
  name: "make:component",
  description: "Create a new Live Component with server and client files",
  category: "Live Components",
  aliases: ["make:live", "create:component", "create:live-component"],
  usage: "flux make:component <ComponentName> [options]",
  examples: [
    "flux make:component UserProfile                # Basic component",
    "flux make:component TodoCounter --type=counter # Counter component",  
    "flux make:component ContactForm --type=form    # Form component",
    "flux make:component LiveChat --type=chat       # Chat component",
    "flux make:component ServerOnly --no-client     # Server-only component",
    "flux make:component MultiUser --room=lobby     # Component with room support"
  ],
  arguments: [
    {
      name: "ComponentName",
      description: "The name of the component in PascalCase (e.g., UserProfile, TodoCounter)",
      required: true,
      type: "string"
    },
  ],
  options: [
    {
      name: "type",
      short: "t",
      description: "Type of component template to generate",
      type: "string",
      default: "basic",
      choices: ["basic", "counter", "form", "chat"]
    },
    {
      name: "no-client",
      description: "Generate only server component (no client file)",
      type: "boolean"
    },
    {
      name: "room",
      short: "r",
      description: "Default room name for multi-user features",
      type: "string"
    },
    {
      name: "force",
      short: "f",
      description: "Overwrite existing files if they exist",
      type: "boolean"
    }
  ],
  handler: async (args, options, context) => {
    const [componentName] = args;
    const { type = 'basic', 'no-client': noClient, room, force } = options;

    // Validation
    if (!componentName || !/^[A-Z][a-zA-Z0-9]*$/.test(componentName)) {
      context.logger.error("❌ Invalid component name. It must be in PascalCase (e.g., UserProfile, TodoCounter).");
      context.logger.info("Examples: UserProfile, TodoCounter, ContactForm, LiveChat");
      return;
    }

    if (!['basic', 'counter', 'form', 'chat'].includes(type)) {
      context.logger.error(`❌ Invalid component type: ${type}`);
      context.logger.info("Available types: basic, counter, form, chat");
      return;
    }

    // File paths
    const serverFilePath = path.join(context.workingDir, "app", "server", "live", `${componentName}Component.ts`);
    const clientFilePath = path.join(context.workingDir, "app", "client", "src", "live", `${componentName}.tsx`);

    try {
      // Check if files exist (unless force flag is used)
      if (!force) {
        const serverExists = await fs.access(serverFilePath).then(() => true).catch(() => false);
        const clientExists = !noClient && await fs.access(clientFilePath).then(() => true).catch(() => false);
        
        if (serverExists || clientExists) {
          context.logger.error(`❌ Component files already exist. Use --force to overwrite.`);
          if (serverExists) context.logger.info(`   Server: ${serverFilePath}`);
          if (clientExists) context.logger.info(`   Client: ${clientFilePath}`);
          return;
        }
      }

      // Ensure directories exist
      await fs.mkdir(path.dirname(serverFilePath), { recursive: true });
      if (!noClient) {
        await fs.mkdir(path.dirname(clientFilePath), { recursive: true });
      }

      // Generate server component
      context.logger.info(`🔥 Creating server component: ${componentName}Component.ts`);
      const serverTemplate = getServerTemplate(componentName, type, room);
      await fs.writeFile(serverFilePath, serverTemplate);

      // Generate client component (unless --no-client)
      if (!noClient) {
        context.logger.info(`⚛️ Creating client component: ${componentName}.tsx`);
        const clientTemplate = getClientTemplate(componentName, type, room);
        await fs.writeFile(clientFilePath, clientTemplate);
      }

      // Success message
      context.logger.info(`✅ Successfully created '${componentName}' live component!`);
      context.logger.info("");
      context.logger.info("📁 Files created:");
      context.logger.info(`   🔥 Server: app/server/live/${componentName}Component.ts`);
      if (!noClient) {
        context.logger.info(`   ⚛️ Client: app/client/src/live/${componentName}.tsx`);
      }
      
      context.logger.info("");
      context.logger.info("🚀 Next steps:");
      context.logger.info("   1. Start dev server: bun run dev");
      if (!noClient) {
        context.logger.info(`   2. Import component in your App.tsx:`);
        context.logger.info(`      import { ${componentName} } from './live/${componentName}'`);
        context.logger.info(`   3. Add component to your JSX: <${componentName} />`);
      }
      
      if (room) {
        context.logger.info(`   4. Component supports multi-user features with room: ${room}`);
      }
      
      if (type !== 'basic') {
        context.logger.info(`   5. Template type '${type}' includes specialized functionality`);
      }

      context.logger.info("");
      context.logger.info("📚 Import guide (Type Inference):");
      context.logger.info("   # Import typed hook and type helpers:");
      context.logger.info("   import { useTypedLiveComponent } from '@core/client';");
      context.logger.info("   import type { InferComponentState } from '@core/client';");
      context.logger.info("");
      context.logger.info("   # Import backend component type for full inference:");
      context.logger.info(`   import type { ${componentName}Component } from '@/server/live/${componentName}Component';`);
      context.logger.info("");
      context.logger.info("   # Use with automatic type inference:");
      context.logger.info(`   const { state, call } = useTypedLiveComponent<${componentName}Component>(...);`);

    } catch (error) {
      context.logger.error(`❌ Failed to create component files: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  },
};