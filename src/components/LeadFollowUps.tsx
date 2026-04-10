import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  MessageSquare, 
  Sparkles,
  Plus,
  X,
  Loader2,
  ChevronRight,
  AlertCircle,
  Phone,
  Mail
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { cn } from '../lib/utils';

interface FollowUp {
  id: string;
  leadId: string;
  leadName: string;
  ownerUid: string;
  status: 'Pending' | 'Completed' | 'Cancelled';
  scheduledAt: any;
  notes?: string;
  aiDraft?: string;
  aiEmailDraft?: string;
  aiWhatsappDraft?: string;
  createdAt: any;
}

interface Lead {
  id: string;
  name: string;
  companyName?: string;
  service: string;
  email?: string;
  phone?: string;
}

export default function LeadFollowUps({ user }: { user: User }) {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  
  // Form state
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [scheduledDate, setScheduledDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [scheduledTime, setScheduledTime] = useState('10:00');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'followups'),
      where('ownerUid', '==', user.uid),
      orderBy('scheduledAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FollowUp[];
      setFollowUps(data);
    });

    // Fetch leads for the dropdown
    const fetchLeads = async () => {
      const leadsQ = query(
        collection(db, 'leads'),
        where('ownerUid', '==', user.uid)
      );
      const leadsSnap = await getDocs(leadsQ);
      const leadsData = leadsSnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        companyName: doc.data().companyName,
        service: doc.data().service,
        email: doc.data().email,
        phone: doc.data().phone
      }));
      setLeads(leadsData);
    };
    fetchLeads();

    return () => unsubscribe();
  }, [user.uid]);

  const handleAddFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId) return;

    setLoading(true);
    const lead = leads.find(l => l.id === selectedLeadId);
    
    try {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);
      await addDoc(collection(db, 'followups'), {
        leadId: selectedLeadId,
        leadName: lead?.companyName || lead?.name || 'Unknown',
        ownerUid: user.uid,
        status: 'Pending',
        scheduledAt: scheduledAt,
        notes: notes,
        createdAt: serverTimestamp()
      });
      setIsAdding(false);
      setSelectedLeadId('');
      setNotes('');
    } catch (error) {
      console.error('Error adding follow-up:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (followUp: FollowUp) => {
    const newStatus = followUp.status === 'Completed' ? 'Pending' : 'Completed';
    try {
      await updateDoc(doc(db, 'followups', followUp.id), {
        status: newStatus
      });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const deleteFollowUp = async (id: string) => {
    if (confirm('Delete this follow-up?')) {
      try {
        await deleteDoc(doc(db, 'followups', id));
      } catch (error) {
        console.error('Error deleting follow-up:', error);
      }
    }
  };

  const draftMessage = async (followUp: FollowUp) => {
    setDraftingId(followUp.id);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const lead = leads.find(l => l.id === followUp.leadId);
      
      const prompt = `Draft a professional follow-up message for a lead.
        Lead Name: ${followUp.leadName}
        Service Interested In: ${lead?.service || 'our services'}
        Context/Notes: ${followUp.notes || 'Checking in on their interest'}
        
        The message should be polite, concise, and encourage a response. 
        Provide a version for Email (with a subject line) and a shorter, more casual version for WhatsApp.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              emailSubject: { type: Type.STRING },
              emailBody: { type: Type.STRING },
              whatsappBody: { type: Type.STRING }
            },
            required: ["emailSubject", "emailBody", "whatsappBody"]
          }
        }
      });

      const draftData = JSON.parse(response.text || '{}');

      await updateDoc(doc(db, 'followups', followUp.id), {
        aiEmailDraft: `${draftData.emailSubject}\n\n${draftData.emailBody}`,
        aiWhatsappDraft: draftData.whatsappBody,
        aiDraft: `EMAIL:\nSubject: ${draftData.emailSubject}\n\n${draftData.emailBody}\n\nWHATSAPP:\n${draftData.whatsappBody}`
      });
    } catch (error) {
      console.error('Error drafting message:', error);
    } finally {
      setDraftingId(null);
    }
  };

  const pendingFollowUps = followUps.filter(f => f.status === 'Pending');
  const completedFollowUps = followUps.filter(f => f.status === 'Completed');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Follow-up Tasks</h1>
          <p className="text-zinc-500">Manage your scheduled interactions and AI drafts.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-all"
        >
          <Plus className="w-5 h-5" />
          Add Task
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pending Tasks */}
        <div className="lg:col-span-2 space-y-6">
          <section>
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Upcoming ({pendingFollowUps.length})
            </h3>
            <div className="space-y-4">
              {pendingFollowUps.length === 0 ? (
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-8 text-center">
                  <Calendar className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                  <p className="text-zinc-500">No upcoming follow-ups scheduled.</p>
                </div>
              ) : (
                pendingFollowUps.map((f) => (
                  <FollowUpCard 
                    key={f.id} 
                    followUp={f} 
                    lead={leads.find(l => l.id === f.leadId)}
                    onToggle={() => toggleStatus(f)}
                    onDelete={() => deleteFollowUp(f.id)}
                    onDraft={() => draftMessage(f)}
                    isDrafting={draftingId === f.id}
                  />
                ))
              )}
            </div>
          </section>

          {completedFollowUps.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Completed
              </h3>
              <div className="space-y-4 opacity-60">
                {completedFollowUps.map((f) => (
                  <FollowUpCard 
                    key={f.id} 
                    followUp={f} 
                    lead={leads.find(l => l.id === f.leadId)}
                    onToggle={() => toggleStatus(f)}
                    onDelete={() => deleteFollowUp(f.id)}
                    onDraft={() => draftMessage(f)}
                    isDrafting={draftingId === f.id}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar / Quick Stats */}
        <div className="space-y-6">
          <div className="bg-[#0f0f0f] border border-zinc-800 rounded-3xl p-6">
            <h3 className="font-bold text-lg mb-4">AI Assistant</h3>
            <div className="space-y-4">
              <div className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-2xl">
                <div className="flex items-center gap-2 text-orange-500 mb-2">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm font-bold uppercase tracking-wider">Pro Tip</span>
                </div>
                <p className="text-sm text-zinc-400">
                  Use the "Draft with AI" button on any task to generate personalized follow-up messages for Email or WhatsApp.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Task Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0f0f0f] border border-zinc-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-xl font-bold">Schedule Follow-up</h3>
                <button onClick={() => setIsAdding(false)} className="text-zinc-500 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddFollowUp} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Select Lead</label>
                  <select
                    required
                    value={selectedLeadId}
                    onChange={(e) => setSelectedLeadId(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:ring-2 focus:ring-orange-500/50 outline-none"
                  >
                    <option value="">Choose a lead...</option>
                    {leads.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.companyName ? `${l.companyName} (${l.name})` : l.name} - {l.service}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Date</label>
                    <input
                      type="date"
                      required
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:ring-2 focus:ring-orange-500/50 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Time</label>
                    <input
                      type="time"
                      required
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:ring-2 focus:ring-orange-500/50 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Notes (Optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Discuss GST filing requirements..."
                    className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:ring-2 focus:ring-orange-500/50 outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all mt-4"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Schedule Task'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FollowUpCard({ 
  followUp, 
  lead,
  onToggle, 
  onDelete, 
  onDraft,
  isDrafting 
}: { 
  followUp: FollowUp, 
  lead?: Lead,
  onToggle: () => void, 
  onDelete: () => void,
  onDraft: () => void,
  isDrafting: boolean
}) {
  const [showDraft, setShowDraft] = useState(false);
  const [editableEmailDraft, setEditableEmailDraft] = useState(followUp.aiEmailDraft || '');
  const [editableWhatsappDraft, setEditableWhatsappDraft] = useState(followUp.aiWhatsappDraft || '');
  const [isSending, setIsSending] = useState<'email' | 'whatsapp' | null>(null);
  const [activeTab, setActiveTab] = useState<'email' | 'whatsapp'>('whatsapp');
  
  const isCompleted = followUp.status === 'Completed';
  const scheduledDate = followUp.scheduledAt?.toDate();

  useEffect(() => {
    if (followUp.aiEmailDraft) setEditableEmailDraft(followUp.aiEmailDraft);
    if (followUp.aiWhatsappDraft) setEditableWhatsappDraft(followUp.aiWhatsappDraft);
  }, [followUp.aiEmailDraft, followUp.aiWhatsappDraft]);

  const sendWhatsApp = async () => {
    if (!lead?.phone) return;
    setIsSending('whatsapp');
    try {
      const response = await fetch('/api/send-lead-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: lead.phone.replace(/\D/g, ''),
          body: editableWhatsappDraft
        })
      });
      if (response.ok) {
        alert('WhatsApp message sent successfully!');
      } else {
        const err = await response.json();
        alert(`Failed to send WhatsApp: ${err.error}`);
      }
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      alert('Error sending WhatsApp message.');
    } finally {
      setIsSending(null);
    }
  };

  const sendEmail = async () => {
    if (!lead?.email) return;
    setIsSending('email');
    try {
      // Split subject and body if possible
      const lines = editableEmailDraft.split('\n');
      const subject = lines[0].replace(/^Subject: /i, '') || `Follow-up: ${lead.service}`;
      const body = lines.slice(1).join('\n').trim();

      const response = await fetch('/api/send-lead-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: lead.email,
          subject: subject,
          body: body
        })
      });
      if (response.ok) {
        alert('Email sent successfully!');
      } else {
        const err = await response.json();
        alert(`Failed to send email: ${err.error}`);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Error sending email.');
    } finally {
      setIsSending(null);
    }
  };

  return (
    <div className="bg-[#0f0f0f] border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="p-5 flex items-start gap-4">
        <button 
          onClick={onToggle}
          className={cn(
            "mt-1 transition-colors",
            isCompleted ? "text-orange-500" : "text-zinc-600 hover:text-zinc-400"
          )}
        >
          {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className={cn("font-bold text-lg truncate", isCompleted && "line-through text-zinc-500")}>
              {followUp.leadName}
            </h4>
            {lead?.companyName && <p className="text-xs text-zinc-500 ml-2">Contact: {lead.name}</p>}
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <button 
                onClick={onDraft}
                disabled={isDrafting || isCompleted}
                className="p-2 text-zinc-500 hover:text-orange-500 disabled:opacity-30 transition-colors"
                title="Draft with AI"
              >
                {isDrafting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </button>
              <button 
                onClick={onDelete}
                className="p-2 text-zinc-500 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-zinc-500 mb-3">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {scheduledDate ? format(scheduledDate, 'MMM d, yyyy') : 'No date'}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {scheduledDate ? format(scheduledDate, 'h:mm a') : 'No time'}
            </div>
          </div>

          {followUp.notes && (
            <p className="text-sm text-zinc-400 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50 mb-3">
              {followUp.notes}
            </p>
          )}

          {(followUp.aiEmailDraft || followUp.aiWhatsappDraft) && (
            <button
              onClick={() => setShowDraft(!showDraft)}
              className="flex items-center gap-2 text-xs font-bold text-orange-500 hover:text-orange-400 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {showDraft ? 'Hide AI Drafts' : 'View AI Drafts'}
              <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", showDraft && "rotate-90")} />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showDraft && (followUp.aiEmailDraft || followUp.aiWhatsappDraft) && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden border-t border-zinc-800"
          >
            <div className="p-5 bg-orange-500/5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-orange-500">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold uppercase tracking-wider">AI Generated Drafts</span>
                </div>
                <div className="flex p-1 bg-zinc-900 rounded-lg">
                  <button 
                    onClick={() => setActiveTab('whatsapp')}
                    className={cn(
                      "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                      activeTab === 'whatsapp' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    WhatsApp
                  </button>
                  <button 
                    onClick={() => setActiveTab('email')}
                    className={cn(
                      "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                      activeTab === 'email' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    Email
                  </button>
                </div>
              </div>

              {activeTab === 'whatsapp' ? (
                <div className="space-y-4">
                  <textarea
                    value={editableWhatsappDraft}
                    onChange={(e) => setEditableWhatsappDraft(e.target.value)}
                    className="w-full h-32 text-sm text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed bg-zinc-950 p-4 rounded-xl border border-zinc-800 focus:ring-1 focus:ring-orange-500 outline-none resize-none"
                  />
                  <div className="flex flex-wrap gap-3">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(editableWhatsappDraft);
                        alert('Copied to clipboard!');
                      }}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                    {lead?.phone && (
                      <button 
                        onClick={sendWhatsApp}
                        disabled={isSending !== null}
                        className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isSending === 'whatsapp' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Phone className="w-3 h-3" />}
                        Send via WhatsApp API
                      </button>
                    )}
                    <div className="flex-1" />
                    <button 
                      onClick={() => {
                        const text = encodeURIComponent(editableWhatsappDraft);
                        const cleanPhone = lead?.phone?.replace(/\D/g, '') || '';
                        window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
                      }}
                      className="text-[10px] text-zinc-500 hover:text-zinc-300 underline"
                    >
                      Open in WhatsApp App
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <textarea
                    value={editableEmailDraft}
                    onChange={(e) => setEditableEmailDraft(e.target.value)}
                    className="w-full h-48 text-sm text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed bg-zinc-950 p-4 rounded-xl border border-zinc-800 focus:ring-1 focus:ring-orange-500 outline-none resize-none"
                  />
                  <div className="flex flex-wrap gap-3">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(editableEmailDraft);
                        alert('Copied to clipboard!');
                      }}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                    {lead?.email && (
                      <button 
                        onClick={sendEmail}
                        disabled={isSending !== null}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isSending === 'email' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                        Send via Email API
                      </button>
                    )}
                    <div className="flex-1" />
                    <button 
                      onClick={() => {
                        const body = encodeURIComponent(editableEmailDraft);
                        window.open(`mailto:${lead?.email}?subject=Follow-up&body=${body}`, '_blank');
                      }}
                      className="text-[10px] text-zinc-500 hover:text-zinc-300 underline"
                    >
                      Open in Mail App
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
