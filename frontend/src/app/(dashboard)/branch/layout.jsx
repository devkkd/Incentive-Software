import Sidebar_branch from '@/components/Sidebar_branch';
import Header_branch from '@/components/Header_branch';

export default function BranchLayout({ children }) {
  return (
    <div className="flex h-screen bg-[#EAF2F9] font-sans text-gray-900 overflow-hidden">
      {/* Sidebar remains fixed on the left */}
      <Sidebar_branch />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header_branch />
        
        {/* This is where page.jsx content will be injected */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}