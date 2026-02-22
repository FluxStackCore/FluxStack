// 🔍 FluxStack Live Debugger - In-Page Overlay Component
//
// Drop this component anywhere in your app to get a floating debug panel
// that shows real-time data for all active Live Components on the page.
//
// Usage:
//   import { LiveDebugger } from '@/core/client'
//   // In your layout or page:
//   <LiveDebugger />
//
// The panel shows:
//   - Active components with current state
//   - Real-time event feed (state changes, actions, rooms, errors)
//   - Component state inspector
//   - Auto-enabled in development only

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useLiveDebugger, type DebugEvent, type DebugEventType, type ComponentSnapshot } from '../hooks/useLiveDebugger'

// ===== Colors & Labels =====

const COLORS: Record<string, string> = {
  COMPONENT_MOUNT: '#22c55e',
  COMPONENT_UNMOUNT: '#ef4444',
  COMPONENT_REHYDRATE: '#f59e0b',
  STATE_CHANGE: '#3b82f6',
  ACTION_CALL: '#8b5cf6',
  ACTION_RESULT: '#06b6d4',
  ACTION_ERROR: '#ef4444',
  ROOM_JOIN: '#10b981',
  ROOM_LEAVE: '#f97316',
  ROOM_EMIT: '#6366f1',
  WS_CONNECT: '#22c55e',
  WS_DISCONNECT: '#ef4444',
  ERROR: '#dc2626',
}

const LABELS: Record<string, string> = {
  COMPONENT_MOUNT: 'MOUNT',
  COMPONENT_UNMOUNT: 'UNMOUNT',
  COMPONENT_REHYDRATE: 'REHYDRATE',
  STATE_CHANGE: 'STATE',
  ACTION_CALL: 'ACTION',
  ACTION_RESULT: 'RESULT',
  ACTION_ERROR: 'ERR',
  ROOM_JOIN: 'JOIN',
  ROOM_LEAVE: 'LEAVE',
  ROOM_EMIT: 'EMIT',
  WS_CONNECT: 'CONNECT',
  WS_DISCONNECT: 'DISCONNECT',
  ERROR: 'ERROR',
}

// ===== Compact JSON Viewer =====

function Json({ data, depth = 0 }: { data: unknown; depth?: number }) {
  if (data === null || data === undefined) return <span style={{ color: '#6b7280' }}>{String(data)}</span>
  if (typeof data === 'boolean') return <span style={{ color: '#f59e0b' }}>{String(data)}</span>
  if (typeof data === 'number') return <span style={{ color: '#60a5fa' }}>{data}</span>
  if (typeof data === 'string') {
    const display = data.length > 80 ? data.slice(0, 80) + '...' : data
    return <span style={{ color: '#34d399' }}>"{display}"</span>
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span style={{ color: '#6b7280' }}>[]</span>
    if (depth > 2) return <span style={{ color: '#6b7280' }}>[{data.length}]</span>
    return (
      <span>
        <span style={{ color: '#6b7280' }}>[</span>
        {data.map((item, i) => (
          <span key={i}>
            {i > 0 && <span style={{ color: '#6b7280' }}>, </span>}
            <Json data={item} depth={depth + 1} />
          </span>
        ))}
        <span style={{ color: '#6b7280' }}>]</span>
      </span>
    )
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>)
    if (entries.length === 0) return <span style={{ color: '#6b7280' }}>{'{}'}</span>
    if (depth > 2) return <span style={{ color: '#6b7280' }}>{'{'}...{entries.length}{'}'}</span>
    return (
      <div style={{ paddingLeft: depth > 0 ? 12 : 0 }}>
        {entries.map(([key, val]) => (
          <div key={key} style={{ lineHeight: '1.5' }}>
            <span style={{ color: '#c084fc' }}>{key}</span>
            <span style={{ color: '#6b7280' }}>: </span>
            <Json data={val} depth={depth + 1} />
          </div>
        ))}
      </div>
    )
  }

  return <span>{String(data)}</span>
}

// ===== Event Summary =====

function eventSummary(e: DebugEvent): string {
  switch (e.type) {
    case 'STATE_CHANGE': {
      const delta = e.data.delta as Record<string, unknown> | undefined
      if (!delta) return ''
      const keys = Object.keys(delta)
      if (keys.length <= 2) return keys.map(k => `${k}=${JSON.stringify(delta[k])}`).join(' ')
      return `${keys.length} props`
    }
    case 'ACTION_CALL':
      return String(e.data.action || '')
    case 'ACTION_RESULT':
      return `${e.data.action} ${e.data.duration}ms`
    case 'ACTION_ERROR':
      return `${e.data.action}: ${e.data.error}`
    case 'ROOM_JOIN':
    case 'ROOM_LEAVE':
      return String(e.data.roomId || '')
    case 'ROOM_EMIT':
      return `${e.data.event} -> ${e.data.roomId}`
    case 'ERROR':
      return String(e.data.error || '')
    default:
      return ''
  }
}

// ===== Component Card =====

/** Display name: uses debugLabel if set, otherwise componentName */
function displayName(comp: ComponentSnapshot): string {
  return comp.debugLabel || comp.componentName
}

function ComponentCard({
  comp,
  isSelected,
  onSelect,
}: {
  comp: ComponentSnapshot
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        padding: '8px 10px', borderRadius: 6, border: 'none',
        background: isSelected ? '#1e293b' : 'transparent',
        color: '#e2e8f0', fontFamily: 'monospace', fontSize: 11,
        display: 'flex', flexDirection: 'column', gap: 2,
        transition: 'background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#22c55e', fontSize: 6 }}>&#9679;</span>
        <strong style={{ fontSize: 12 }}>{displayName(comp)}</strong>
      </div>
      {comp.debugLabel && (
        <div style={{ fontSize: 9, color: '#64748b' }}>{comp.componentName}</div>
      )}
      <div style={{ display: 'flex', gap: 10, color: '#64748b', fontSize: 10 }}>
        <span>state:{comp.stateChangeCount}</span>
        <span>actions:{comp.actionCount}</span>
        {comp.errorCount > 0 && <span style={{ color: '#f87171' }}>err:{comp.errorCount}</span>}
        {comp.rooms.length > 0 && <span>room:{comp.rooms.join(',')}</span>}
      </div>
    </button>
  )
}

// ===== Main Component =====

export interface LiveDebuggerProps {
  /** Start expanded. Default: false */
  defaultOpen?: boolean
  /** Position on screen. Default: 'bottom' */
  position?: 'bottom' | 'right'
  /** Max height when at bottom. Default: 340 */
  maxHeight?: number
  /** Max width when on right. Default: 420 */
  maxWidth?: number
}

export function LiveDebugger({
  defaultOpen = false,
  position = 'bottom',
  maxHeight = 340,
  maxWidth = 420,
}: LiveDebuggerProps) {
  const dbg = useLiveDebugger({ maxEvents: 200 })
  const [open, setOpen] = useState(defaultOpen)
  const [tab, setTab] = useState<'events' | 'state'>('events')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const feedRef = useRef<HTMLDivElement>(null)

  const selectedComp = selectedId
    ? dbg.components.find(c => c.componentId === selectedId) ?? null
    : null

  // Filter events to selected component
  const visibleEvents = selectedId
    ? dbg.events.filter(e => e.componentId === selectedId)
    : dbg.events

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current && !dbg.paused) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [visibleEvents.length, dbg.paused])

  const toggleEvent = useCallback((id: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Collapsed bar
  if (!open) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 99999,
          height: 32,
          background: '#020617',
          borderTop: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 10,
          fontFamily: 'monospace',
          fontSize: 11,
          color: '#94a3b8',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setOpen(true)}
      >
        <span style={{ fontSize: 14 }}>&#128269;</span>
        <span style={{ fontWeight: 600, letterSpacing: 0.5 }}>LIVE DEBUGGER</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          color: dbg.connected ? '#22c55e' : '#ef4444',
        }}>
          <span style={{ fontSize: 6 }}>&#9679;</span>
          {dbg.connected ? 'connected' : 'disconnected'}
        </span>
        <span style={{ color: '#475569' }}>
          {dbg.componentCount} components
        </span>
        <span style={{ color: '#475569' }}>
          {dbg.eventCount} events
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ color: '#475569' }}>click to expand &#9650;</span>
      </div>
    )
  }

  // Expanded panel
  const isBottom = position === 'bottom'
  const panelStyle: React.CSSProperties = isBottom
    ? {
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99999,
        height: maxHeight, display: 'flex', flexDirection: 'column',
      }
    : {
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 99999,
        width: maxWidth, display: 'flex', flexDirection: 'column',
      }

  return (
    <div style={{
      ...panelStyle,
      background: '#020617',
      borderTop: isBottom ? '1px solid #334155' : 'none',
      borderLeft: !isBottom ? '1px solid #334155' : 'none',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#e2e8f0',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', borderBottom: '1px solid #1e293b',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13 }}>&#128269;</span>
        <span style={{
          fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
          letterSpacing: 0.5,
        }}>
          LIVE DEBUGGER
        </span>

        <span style={{
          fontFamily: 'monospace', fontSize: 10,
          display: 'inline-flex', alignItems: 'center', gap: 3,
          color: dbg.connected ? '#22c55e' : '#ef4444',
        }}>
          <span style={{ fontSize: 6 }}>&#9679;</span>
          {dbg.connected ? 'on' : 'off'}
        </span>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, marginLeft: 8 }}>
          {(['events', 'state'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                fontFamily: 'monospace', fontSize: 10, textTransform: 'uppercase',
                background: tab === t ? '#1e293b' : 'transparent',
                color: tab === t ? '#e2e8f0' : '#64748b',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Controls */}
        <button
          onClick={dbg.togglePause}
          style={{
            padding: '2px 6px', borderRadius: 3, border: 'none', cursor: 'pointer',
            fontFamily: 'monospace', fontSize: 10,
            background: dbg.paused ? '#7c2d12' : '#1e293b',
            color: dbg.paused ? '#fdba74' : '#94a3b8',
          }}
        >
          {dbg.paused ? '&#9654; Resume' : '&#9646;&#9646; Pause'}
        </button>
        <button
          onClick={dbg.clearEvents}
          style={{
            padding: '2px 6px', borderRadius: 3, border: 'none', cursor: 'pointer',
            fontFamily: 'monospace', fontSize: 10,
            background: '#1e293b', color: '#94a3b8',
          }}
        >
          Clear
        </button>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#475569' }}>
          {dbg.componentCount}C {dbg.eventCount}E
        </span>
        <button
          onClick={() => setOpen(false)}
          style={{
            padding: '2px 6px', borderRadius: 3, border: 'none', cursor: 'pointer',
            fontFamily: 'monospace', fontSize: 12,
            background: 'transparent', color: '#64748b',
          }}
        >
          &#9660;
        </button>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Component list sidebar */}
        <div style={{
          width: 180, borderRight: '1px solid #1e293b',
          overflow: 'auto', flexShrink: 0, padding: '4px 4px',
        }}>
          {/* All button */}
          <button
            onClick={() => setSelectedId(null)}
            style={{
              width: '100%', textAlign: 'left', cursor: 'pointer',
              padding: '6px 10px', borderRadius: 6, border: 'none',
              background: selectedId === null ? '#1e293b' : 'transparent',
              color: '#94a3b8', fontFamily: 'monospace', fontSize: 11,
            }}
          >
            All ({dbg.componentCount})
          </button>

          {dbg.components.map(comp => (
            <ComponentCard
              key={comp.componentId}
              comp={comp}
              isSelected={selectedId === comp.componentId}
              onSelect={() => {
                setSelectedId(selectedId === comp.componentId ? null : comp.componentId)
                setTab('events') // switch to events when selecting a component
              }}
            />
          ))}

          {dbg.components.length === 0 && (
            <div style={{
              padding: 12, textAlign: 'center', color: '#475569',
              fontFamily: 'monospace', fontSize: 10,
            }}>
              No components
            </div>
          )}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {tab === 'events' ? (
            /* Events feed */
            <div ref={feedRef} style={{ flex: 1, overflow: 'auto' }}>
              {visibleEvents.length === 0 ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: '100%', color: '#475569', fontFamily: 'monospace', fontSize: 11,
                }}>
                  {dbg.connected
                    ? dbg.paused ? 'Paused' : 'Waiting for events...'
                    : 'Connecting...'}
                </div>
              ) : (
                visibleEvents.map(event => {
                  const color = COLORS[event.type] || '#6b7280'
                  const label = LABELS[event.type] || event.type
                  const summary = eventSummary(event)
                  const isExpanded = expandedEvents.has(event.id)
                  const time = new Date(event.timestamp)
                  const ts = `${time.toLocaleTimeString('en-US', { hour12: false })}.${String(time.getMilliseconds()).padStart(3, '0')}`

                  return (
                    <div
                      key={event.id}
                      style={{ borderBottom: '1px solid #0f172a', cursor: 'pointer' }}
                      onClick={() => toggleEvent(event.id)}
                    >
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 10px', fontSize: 11, fontFamily: 'monospace',
                        background: isExpanded ? '#0f172a' : 'transparent',
                      }}>
                        <span style={{ color: '#4b5563', fontSize: 10, flexShrink: 0 }}>{ts}</span>
                        <span style={{
                          display: 'inline-block', padding: '0 5px', borderRadius: 3,
                          fontSize: 9, fontWeight: 700, color: '#fff',
                          background: color, flexShrink: 0, lineHeight: '16px',
                        }}>
                          {label}
                        </span>
                        {!selectedId && event.componentName && (() => {
                          const comp = dbg.components.find(c => c.componentId === event.componentId)
                          const label = comp?.debugLabel || event.componentName
                          return (
                            <span style={{ color: '#64748b', flexShrink: 0, fontSize: 10 }}>
                              {label}
                            </span>
                          )
                        })()}
                        <span style={{
                          color: '#94a3b8', fontSize: 10, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                        }}>
                          {summary}
                        </span>
                      </div>
                      {isExpanded && (
                        <div style={{
                          padding: '4px 10px 8px 46px', fontSize: 10,
                          fontFamily: 'monospace', color: '#cbd5e1',
                          background: '#0f172a',
                        }}>
                          <Json data={event.data} />
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          ) : (
            /* State inspector */
            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              {selectedComp ? (
                <div>
                  <div style={{
                    fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
                    marginBottom: 2, color: '#f1f5f9',
                  }}>
                    {displayName(selectedComp)}
                  </div>
                  {selectedComp.debugLabel && (
                    <div style={{
                      fontFamily: 'monospace', fontSize: 10, color: '#64748b',
                      marginBottom: 6,
                    }}>
                      {selectedComp.componentName}
                    </div>
                  )}

                  {/* Stats row */}
                  <div style={{
                    display: 'flex', gap: 6, marginBottom: 12,
                    fontFamily: 'monospace', fontSize: 10,
                  }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: 4, background: '#1e293b',
                    }}>
                      <span style={{ color: '#3b82f6' }}>{selectedComp.stateChangeCount}</span>
                      <span style={{ color: '#64748b' }}> state</span>
                    </span>
                    <span style={{
                      padding: '3px 8px', borderRadius: 4, background: '#1e293b',
                    }}>
                      <span style={{ color: '#8b5cf6' }}>{selectedComp.actionCount}</span>
                      <span style={{ color: '#64748b' }}> actions</span>
                    </span>
                    <span style={{
                      padding: '3px 8px', borderRadius: 4, background: '#1e293b',
                    }}>
                      <span style={{ color: selectedComp.errorCount > 0 ? '#ef4444' : '#22c55e' }}>
                        {selectedComp.errorCount}
                      </span>
                      <span style={{ color: '#64748b' }}> errors</span>
                    </span>
                    {selectedComp.rooms.length > 0 && (
                      <span style={{
                        padding: '3px 8px', borderRadius: 4, background: '#1e293b',
                        color: '#64748b',
                      }}>
                        rooms: {selectedComp.rooms.join(', ')}
                      </span>
                    )}
                  </div>

                  {/* ID */}
                  <div style={{
                    fontFamily: 'monospace', fontSize: 10, color: '#475569',
                    marginBottom: 10,
                  }}>
                    {selectedComp.componentId}
                  </div>

                  {/* State tree */}
                  <div style={{
                    fontFamily: 'monospace', fontSize: 10, color: '#64748b',
                    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
                  }}>
                    Current State
                  </div>
                  <div style={{
                    padding: 10, background: '#0f172a', borderRadius: 6,
                    fontFamily: 'monospace', fontSize: 11, color: '#e2e8f0',
                    maxHeight: 200, overflow: 'auto',
                  }}>
                    <Json data={selectedComp.state} />
                  </div>
                </div>
              ) : (
                /* All components state overview */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dbg.components.length === 0 ? (
                    <div style={{
                      textAlign: 'center', color: '#475569',
                      fontFamily: 'monospace', fontSize: 11, padding: 20,
                    }}>
                      No active components
                    </div>
                  ) : (
                    dbg.components.map(comp => (
                      <div key={comp.componentId} style={{
                        padding: 10, background: '#0f172a', borderRadius: 6,
                      }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          marginBottom: 6,
                        }}>
                          <span style={{
                            fontFamily: 'monospace', fontSize: 12,
                            fontWeight: 700, color: '#f1f5f9',
                          }}>
                            {displayName(comp)}
                          </span>
                          <span style={{
                            fontFamily: 'monospace', fontSize: 9, color: '#475569',
                          }}>
                            S:{comp.stateChangeCount} A:{comp.actionCount}
                            {comp.errorCount > 0 && <span style={{ color: '#f87171' }}> E:{comp.errorCount}</span>}
                          </span>
                        </div>
                        <div style={{
                          fontFamily: 'monospace', fontSize: 10, color: '#e2e8f0',
                        }}>
                          <Json data={comp.state} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
