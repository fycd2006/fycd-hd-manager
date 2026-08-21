'use client';

import React from 'react';

export interface WorkspaceGridSkeletonProps {
  loadingText?: string
}

export const WorkspaceGridSkeleton: React.FC<WorkspaceGridSkeletonProps> = ({ loadingText }) => {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      minHeight: '360px',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#ffffff',
      position: 'relative',
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      {/* Top Brand Subtle Progress Line */}
      <div style={{
        height: '2.5px',
        width: '100%',
        background: 'linear-gradient(90deg, #52A628 0%, #EA580C 50%, #52A628 100%)',
        backgroundSize: '200% 100%',
        animation: 'fycdBarShimmer 2s ease-in-out infinite',
      }} />

      {/* Optional Loading Banner */}
      {loadingText && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #f1f5f9',
          fontSize: '12px',
          color: '#64748b',
          fontWeight: 500,
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#52A628' }} />
          <span>{loadingText}</span>
        </div>
      )}

      {/* Skeleton Table Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: '38px',
        borderBottom: '1px solid #e2e8f0',
        backgroundColor: '#f8fafc',
        padding: '0 12px',
        gap: '12px',
        flexShrink: 0,
      }}>
        <div style={{ width: '32px', height: '14px', borderRadius: '4px', backgroundColor: '#e2e8f0' }} />
        <div style={{ width: '160px', height: '14px', borderRadius: '4px', backgroundColor: '#cbd5e1' }} />
        <div style={{ width: '140px', height: '14px', borderRadius: '4px', backgroundColor: '#e2e8f0' }} />
        <div style={{ width: '120px', height: '14px', borderRadius: '4px', backgroundColor: '#e2e8f0' }} />
        <div style={{ width: '150px', height: '14px', borderRadius: '4px', backgroundColor: '#e2e8f0' }} />
        <div style={{ flex: 1, height: '14px', borderRadius: '4px', backgroundColor: '#f1f5f9' }} />
      </div>

      {/* Skeleton Table Rows */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {[0.65, 0.85, 0.45, 0.75, 0.90, 0.55].map((widthRatio, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: '36px',
              borderBottom: '1px solid #f1f5f9',
              backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa',
              padding: '0 12px',
              gap: '12px',
              animation: `fycdRowPulse 1.8s ease-in-out ${idx * 0.1}s infinite alternate`,
            }}
          >
            <div style={{ width: '32px', height: '12px', borderRadius: '3px', backgroundColor: '#f1f5f9' }} />
            <div style={{ width: `${Math.round(160 * widthRatio)}px`, height: '14px', borderRadius: '4px', backgroundColor: '#e2e8f0' }} />
            <div style={{ width: '88px', height: '18px', borderRadius: '12px', backgroundColor: idx % 2 === 0 ? '#dcfce7' : '#ffedd5', opacity: 0.8 }} />
            <div style={{ width: '70px', height: '12px', borderRadius: '4px', backgroundColor: '#f1f5f9' }} />
            <div style={{ width: '110px', height: '12px', borderRadius: '4px', backgroundColor: '#f1f5f9' }} />
            <div style={{ flex: 1 }} />
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes fycdBarShimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes fycdRowPulse {
          0% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};
