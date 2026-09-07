import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function AlertBanner({ alerts, onDismissAll }) {
  if (!alerts || alerts.length === 0) {
    return <div className="alert-banner alert-banner-empty" />;
  }

  // Duplicate alerts for seamless infinite scroll
  const scrollAlerts = [...alerts, ...alerts];

  return (
    <div className="alert-banner">
      <div style={{ padding: '0 12px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <AlertTriangle size={14} style={{ color: 'var(--accent-warning)' }} />
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div className="alert-scroll">
          {scrollAlerts.map((alert, i) => (
            <div className="alert-item" key={`${alert.id}-${i}`}>
              <span className={`alert-badge ${alert.severity}`}>
                {alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '⚠️' : 'ℹ️'}{' '}
                {alert.severity}
              </span>
              <span className="alert-text">{alert.message}</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {alert.time}
              </span>
            </div>
          ))}
        </div>
      </div>
      <button className="alert-dismiss" onClick={onDismissAll} title="Dismiss all alerts">
        <X size={12} />
      </button>
    </div>
  );
}
