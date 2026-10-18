'use client';

import React from 'react';
import { motion } from 'motion/react';

export interface WorkspaceGridSkeletonProps {
  loadingText?: string;
}

export const WorkspaceGridSkeleton: React.FC<WorkspaceGridSkeletonProps> = ({ loadingText }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        width: '100%',
        height: '100%',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Top Brand Subtle Progress Line */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          height: '2.5px',
          width: '100%',
          background: 'linear-gradient(90deg, #39452B 0%, #F58220 50%, #39452B 100%)',
          backgroundSize: '200% 100%',
          animation: 'fycdBarShimmer 2s ease-in-out infinite',
        }}
      />

      {/* Optional Loading Banner */}
      {loadingText && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #f1f5f9',
            fontSize: '12px',
            color: '#64748b',
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#F58220',
              display: 'inline-block',
              animation: 'fycdRowPulse 1.2s ease-in-out infinite alternate',
            }}
          />
          <span>{loadingText}</span>
        </div>
      )}

      {/* 桌機：寬表格骨架（≤768px 時由 CSS 隱藏） */}
      <div className="fycd-grid-skeleton-desktop">
      {/* Skeleton Table Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '38px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          padding: '0 12px',
          gap: '12px',
          flexShrink: 0,
        }}
      >
        <div className="fycd-skeleton" style={{ width: '32px', height: '14px', borderRadius: '4px' }} />
        <div className="fycd-skeleton" style={{ width: '160px', height: '14px', borderRadius: '4px' }} />
        <div className="fycd-skeleton" style={{ width: '140px', height: '14px', borderRadius: '4px' }} />
        <div className="fycd-skeleton" style={{ width: '120px', height: '14px', borderRadius: '4px' }} />
        <div className="fycd-skeleton" style={{ width: '150px', height: '14px', borderRadius: '4px' }} />
        <div className="fycd-skeleton" style={{ flex: 1, height: '14px', borderRadius: '4px' }} />
      </div>

      {/* Skeleton Table Rows with staggered organic shimmer */}
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
            }}
          >
            <div className="fycd-skeleton" style={{ width: '32px', height: '12px', borderRadius: '3px' }} />
            <div
              style={{
                width: `${Math.round(160 * widthRatio)}px`,
                height: '14px',
                borderRadius: '4px',
                backgroundColor: '#e2e8f0',
              }}
            />
            <div
              style={{
                width: '88px',
                height: '18px',
                borderRadius: '12px',
                backgroundColor: idx % 2 === 0 ? '#dcfce7' : '#ffedd5',
                opacity: 0.8,
              }}
            />
            <div className="fycd-skeleton" style={{ width: '70px', height: '12px', borderRadius: '4px' }} />
            <div className="fycd-skeleton" style={{ width: '110px', height: '12px', borderRadius: '4px' }} />
            <div style={{ flex: 1 }} />
          </div>
        ))}
      </div>
      </div>

      {/* 手機：窄表格骨架（列號＋首欄＋2 欄），≤768px 時顯示 */}
      <div className="fycd-grid-skeleton-mobile">
        <div className="fycd-grid-skeleton-mobile__row fycd-grid-skeleton-mobile__head">
          <div className="fycd-skeleton" style={{ width: '20px', height: '12px', borderRadius: '3px' }} />
          <div className="fycd-skeleton" style={{ width: '96px', height: '14px', borderRadius: '4px' }} />
          <div className="fycd-skeleton" style={{ width: '64px', height: '14px', borderRadius: '4px' }} />
          <div className="fycd-skeleton" style={{ width: '56px', height: '14px', borderRadius: '4px' }} />
        </div>
        {[0.9, 0.6, 0.8, 0.5, 0.75, 0.65, 0.85, 0.55].map((widthRatio, idx) => (
          <div key={idx} className="fycd-grid-skeleton-mobile__row">
            <div className="fycd-skeleton" style={{ width: '16px', height: '10px', borderRadius: '3px' }} />
            <div className="fycd-skeleton" style={{ width: `${Math.round(110 * widthRatio)}px`, height: '14px', borderRadius: '4px' }} />
            <div className="fycd-skeleton" style={{ width: '60px', height: '18px', borderRadius: '10px' }} />
            <div className="fycd-skeleton" style={{ width: '48px', height: '12px', borderRadius: '4px' }} />
          </div>
        ))}
      </div>
    </motion.div>
  );
};
