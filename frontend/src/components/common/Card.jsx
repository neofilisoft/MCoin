import React from 'react';

export function Card({ children, className = '', glow = false, hover = false, ...props }) {
  const baseClass = glow
    ? 'glass-panel-glow'
    : 'glass-panel';
  const hoverClass = hover ? 'transition-all duration-200 hover:border-brand-500/40 hover:bg-slate-900/80 hover:-translate-y-0.5' : '';

  return (
    <div
      className={`rounded-2xl p-6 ${baseClass} ${hoverClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`flex items-start justify-between mb-5 ${className}`}>
      <div>
        <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
