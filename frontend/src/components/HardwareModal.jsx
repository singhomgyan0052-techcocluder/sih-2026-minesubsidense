import React from 'react';
import { X, Cpu, Wifi, Code } from 'lucide-react';

export function HardwareIntegrationModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu className="icon-blue" />
            <h2>Hardware Integration Guide</h2>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p>
            This platform is ready to accept real-time sensor data from physical hardware nodes (e.g., ESP32, Arduino, Raspberry Pi) via MQTT.
          </p>

          <div className="integration-card" style={{ background: 'var(--surface-color)', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wifi size={16} /> Connection Details
            </h3>
            <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-secondary)' }}>
              <li><strong>Protocol:</strong> MQTT (v3.1.1 or v5)</li>
              <li><strong>Broker:</strong> <code>test.mosquitto.org</code></li>
              <li><strong>Port:</strong> <code>1883</code> (Unencrypted) / <code>8883</code> (TLS)</li>
              <li><strong>Topic:</strong> <code>subsidence/telemetry/#</code></li>
            </ul>
          </div>

          <div className="integration-card" style={{ background: 'var(--surface-color)', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Code size={16} /> JSON Payload Format
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Publish messages to <code>subsidence/telemetry/&lt;NODE_ID&gt;</code> with the following JSON structure:
            </p>
            <pre style={{ margin: 0, padding: 12, background: 'var(--bg-color)', borderRadius: 4, fontSize: 13, border: '1px solid var(--border-color)' }}>
{`{
  "gw": "GW-1",
  "node": "NODE-123",
  "z": 0.05,
  "tilt_x": 0.01,
  "tilt_y": -0.02,
  "strain": 45.2,
  "bat": 85,
  "rssi": -65
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
