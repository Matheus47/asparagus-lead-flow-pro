import React from 'react';
import Sidebar from './components/layout/Sidebar';

export default function Layout({ children, currentPageName }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar currentPage={currentPageName} unreadInsights={0} />
      <div className="ml-64 transition-all duration-300">
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}