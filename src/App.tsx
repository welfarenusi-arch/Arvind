/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User
} from 'firebase/auth';
import { 
  doc,
  setDoc,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Search, 
  LogOut, 
  LogIn, 
  TrendingUp,
  Settings,
  Menu,
  X,
  Zap,
  CalendarCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Components
import LeadDashboard from './components/LeadDashboard';
import LeadFinder from './components/LeadFinder';
import LeadStats from './components/LeadStats';
import LeadSettings from './components/LeadSettings';
import LeadFollowUps from './components/LeadFollowUps';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'finder' | 'stats' | 'settings' | 'followups'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Sync user to Firestore
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            role: 'agent',
            createdAt: serverTimestamp()
          });
        }
        setUser(user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const logout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="space-y-2">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/20">
                <Zap className="w-8 h-8 text-orange-500" />
              </div>
            </div>
            <h1 className="text-4xl font-bold tracking-tight">LeadFinder AI</h1>
            <p className="text-zinc-400">Automated lead generation & CRM for business services.</p>
          </div>
          
          <button
            onClick={login}
            className="w-full flex items-center justify-center gap-3 bg-white text-black font-semibold py-4 px-6 rounded-xl hover:bg-zinc-200 transition-colors"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Google
          </button>
          
          <div className="grid grid-cols-2 gap-4 text-xs text-zinc-500 uppercase tracking-widest font-bold">
            <div className="p-4 border border-zinc-800 rounded-xl">GST & MSME</div>
            <div className="p-4 border border-zinc-800 rounded-xl">Trademark & ISO</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex">
        {/* Sidebar */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-[#0f0f0f] border-r border-zinc-800 transition-transform duration-300 lg:relative lg:translate-x-0",
          !isSidebarOpen && "-translate-x-full"
        )}>
          <div className="h-full flex flex-col">
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6 text-orange-500" />
                <span className="font-bold text-xl tracking-tight">LeadFinder</span>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-4 space-y-2">
              <NavItem 
                icon={<LayoutDashboard />} 
                label="Dashboard" 
                active={activeTab === 'dashboard'} 
                onClick={() => setActiveTab('dashboard')} 
              />
              <NavItem 
                icon={<Search />} 
                label="AI Lead Finder" 
                active={activeTab === 'finder'} 
                onClick={() => setActiveTab('finder')} 
              />
              <NavItem 
                icon={<CalendarCheck />} 
                label="Follow-ups" 
                active={activeTab === 'followups'} 
                onClick={() => setActiveTab('followups')} 
              />
              <NavItem 
                icon={<TrendingUp />} 
                label="Analytics" 
                active={activeTab === 'stats'} 
                onClick={() => setActiveTab('stats')} 
              />
              <NavItem 
                icon={<Settings />} 
                label="Settings" 
                active={activeTab === 'settings'} 
                onClick={() => setActiveTab('settings')} 
              />
            </nav>

            <div className="p-4 border-t border-zinc-800">
              <div className="flex items-center gap-3 p-2 mb-4">
                <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full bg-zinc-800" referrerPolicy="no-referrer" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.displayName}</p>
                  <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                </div>
              </div>
              <button 
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-40">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden">
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold capitalize">{activeTab}</h2>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 text-zinc-400 hover:text-white transition-colors">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="max-w-7xl mx-auto"
              >
                {activeTab === 'dashboard' && <LeadDashboard user={user} />}
                {activeTab === 'finder' && <LeadFinder user={user} />}
                {activeTab === 'followups' && <LeadFollowUps user={user} />}
                {activeTab === 'stats' && <LeadStats user={user} />}
                {activeTab === 'settings' && <LeadSettings user={user} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
        active 
          ? "bg-orange-500/10 text-orange-500 border border-orange-500/20" 
          : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
      )}
    >
      {active ? (
        <motion.div layoutId="active-nav" className="absolute left-0 w-1 h-6 bg-orange-500 rounded-r-full" />
      ) : null}
      <span className={cn("w-5 h-5", active && "text-orange-500")}>{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

