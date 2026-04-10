import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { 
  Mail, 
  Bell, 
  Shield, 
  Save,
  CheckCircle2,
  AlertCircle,
  MessageSquare
} from 'lucide-react';
import { motion } from 'motion/react';

export default function LeadSettings({ user }: { user: User }) {
  const [prefs, setPrefs] = useState({
    emailEnabled: false,
    whatsappEnabled: false,
    minScore: 70
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().notificationPrefs) {
          setPrefs(userDoc.data().notificationPrefs);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPrefs();
  }, [user.uid]);

  const savePrefs = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        notificationPrefs: prefs
      });
      setMessage({ type: 'success', text: 'Preferences saved successfully!' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to save preferences.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="animate-pulse h-64 bg-zinc-900/50 rounded-3xl" />;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="bg-[#0f0f0f] border border-zinc-800 rounded-3xl p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center">
            <Bell className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Notification Preferences</h3>
            <p className="text-zinc-500 text-sm">Configure how and when you want to be notified about new leads.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-zinc-400" />
              <div>
                <p className="font-semibold">Email Notifications</p>
                <p className="text-xs text-zinc-500">Receive an email for every high-score lead.</p>
              </div>
            </div>
            <button
              onClick={() => setPrefs({ ...prefs, emailEnabled: !prefs.emailEnabled })}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                prefs.emailEnabled ? 'bg-orange-500' : 'bg-zinc-700'
              }`}
            >
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                prefs.emailEnabled ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-zinc-400" />
              <div>
                <p className="font-semibold">WhatsApp Notifications</p>
                <p className="text-xs text-zinc-500">Receive a WhatsApp alert for every high-score lead.</p>
              </div>
            </div>
            <button
              onClick={() => setPrefs({ ...prefs, whatsappEnabled: !prefs.whatsappEnabled })}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                prefs.whatsappEnabled ? 'bg-orange-500' : 'bg-zinc-700'
              }`}
            >
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                prefs.whatsappEnabled ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>

          <div className="space-y-4 p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-zinc-400" />
                <div>
                  <p className="font-semibold">Minimum AI Score</p>
                  <p className="text-xs text-zinc-500">Only notify for leads with score above this value.</p>
                </div>
              </div>
              <span className="text-lg font-bold text-orange-500">{prefs.minScore}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={prefs.minScore}
              onChange={(e) => setPrefs({ ...prefs, minScore: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
            <div className="flex justify-between text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
              <span>Low Quality</span>
              <span>High Quality</span>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {message.text && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex items-center gap-2 text-sm ${
                  message.type === 'success' ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {message.text}
              </motion.div>
            )}
          </div>
          <button
            onClick={savePrefs}
            disabled={saving}
            className="flex items-center gap-2 bg-white text-black font-bold py-3 px-8 rounded-xl hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 transition-all"
          >
            {saving ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
            Save Changes
          </button>
        </div>
      </div>

      <div className="bg-orange-500/5 border border-orange-500/10 rounded-3xl p-6">
        <h4 className="text-sm font-bold text-orange-500 uppercase tracking-widest mb-2">Note on SMTP</h4>
        <p className="text-sm text-zinc-500 leading-relaxed">
          Email notifications require SMTP configuration in the server environment. 
          If not configured, notifications will be logged to the server console for demonstration purposes.
        </p>
      </div>
    </div>
  );
}
