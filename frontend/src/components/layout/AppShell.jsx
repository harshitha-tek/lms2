import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { WithdrawalBanner } from '../common/WithdrawalBanner';

export const AppShell = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-gradient)' }}>
      {/* Sidebar Navigation */}
      <Sidebar isMobileOpen={isMobileOpen} closeMobile={() => setIsMobileOpen(false)} />

      {/* Main Area */}
      <div
        style={{
          flex: 1,
          marginLeft: '260px',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          transition: 'margin-left 0.3s ease',
        }}
        className="main-layout-area"
      >
        <Topbar toggleMobile={() => setIsMobileOpen(!isMobileOpen)} />
        
        {/* Persistent High-Visibility Banner for advance leave rejected per FRD 7.3.2 */}
        <WithdrawalBanner />

        <main style={{ flex: 1, padding: '24px 0' }}>
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .main-layout-area {
            margin-left: 0 !important;
          }
          aside.mobile-open {
            transform: translateX(0) !important;
          }
          aside:not(.mobile-open) {
            transform: translateX(-100%) !important;
          }
        }
      `}</style>
    </div>
  );
};
