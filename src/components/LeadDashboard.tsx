import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  updateDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { 
  MoreVertical, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar,
  Filter,
  ArrowUpDown,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Search,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CalendarCheck,
  Plus,
  X,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

interface Lead {
  id: string;
  name: string;
  companyName?: string;
  phone?: string;
  email?: string;
  city?: string;
  service: string;
  status: 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost';
  priority: 'High' | 'Medium' | 'Low';
  score: number;
  createdAt: any;
  source?: string;
  publishedDate?: string;
}

export default function LeadDashboard({ user }: { user: User }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [isAddingFollowUp, setIsAddingFollowUp] = useState<Lead | null>(null);
  const [followUpDate, setFollowUpDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [followUpTime, setFollowUpTime] = useState('10:00');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);

  const downloadExcel = () => {
    const dataToExport = leads.map(lead => ({
      'Company Name': lead.companyName || 'N/A',
      'Contact Person': lead.name,
      'Email': lead.email || 'N/A',
      'Phone': lead.phone || 'N/A',
      'City': lead.city || 'N/A',
      'Service': lead.service,
      'Status': lead.status,
      'Priority': lead.priority,
      'Score': lead.score,
      'Source': lead.source || 'N/A',
      'Published Date': lead.publishedDate || 'N/A',
      'Created At': lead.createdAt?.toDate?.()?.toLocaleString() || 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
    XLSX.writeFile(workbook, "Leads_Data.xlsx");
  };

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  useEffect(() => {
    const q = query(
      collection(db, 'leads'),
      where('ownerUid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leadsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Lead[];
      setLeads(leadsData);
    });

    return () => unsubscribe();
  }, [user.uid]);

  const updateStatus = async (id: string, status: Lead['status']) => {
    const path = `leads/${id}`;
    try {
      await updateDoc(doc(db, 'leads', id), { 
        status,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const deleteLead = async (id: string) => {
    const path = `leads/${id}`;
    if (confirm('Are you sure you want to delete this lead?')) {
      try {
        await deleteDoc(doc(db, 'leads', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    }
  };

  const handleAddFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddingFollowUp) return;

    setIsSubmittingFollowUp(true);
    try {
      const scheduledAt = new Date(`${followUpDate}T${followUpTime}`);
      await addDoc(collection(db, 'followups'), {
        leadId: isAddingFollowUp.id,
        leadName: isAddingFollowUp.name,
        ownerUid: user.uid,
        status: 'Pending',
        scheduledAt: scheduledAt,
        notes: followUpNotes,
        createdAt: serverTimestamp()
      });
      setIsAddingFollowUp(null);
      setFollowUpNotes('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'followups');
    } finally {
      setIsSubmittingFollowUp(false);
    }
  };

  const filteredLeads = leads
    .filter(l => {
      const matchesFilter = filter === 'All' || l.status === filter;
      const matchesSearch = l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           l.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           l.service.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFilter && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score;
      return b.createdAt?.seconds - a.createdAt?.seconds;
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search leads by name or service..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            {['All', 'New', 'Contacted', 'Qualified', 'Converted', 'Lost'].map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                  filter === s 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={downloadExcel}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors text-zinc-300"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
          <button 
            onClick={() => setSortBy(sortBy === 'date' ? 'score' : 'date')}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            <ArrowUpDown className="w-4 h-4" />
            Sort by {sortBy === 'date' ? 'Score' : 'Date'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredLeads.map((lead) => (
            <motion.div
              layout
              key={lead.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`bg-[#0f0f0f] border rounded-2xl p-5 transition-all group cursor-pointer ${
                expandedLeadId === lead.id ? 'border-orange-500/50 ring-1 ring-orange-500/20' : 'border-zinc-800 hover:border-zinc-700'
              }`}
              onClick={() => setExpandedLeadId(expandedLeadId === lead.id ? null : lead.id)}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
                    lead.priority === 'High' ? 'bg-red-500/10 text-red-500' :
                    lead.priority === 'Medium' ? 'bg-orange-500/10 text-orange-500' :
                    'bg-blue-500/10 text-blue-500'
                  }`}>
                    {(lead.companyName || lead.name).charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{lead.companyName || lead.name}</h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        lead.priority === 'High' ? 'bg-red-500/20 text-red-500' :
                        lead.priority === 'Medium' ? 'bg-orange-500/20 text-orange-500' :
                        'bg-blue-500/20 text-blue-500'
                      }`}>
                        {lead.priority}
                      </span>
                    </div>
                    <p className="text-zinc-400 text-sm font-medium">
                      {lead.companyName ? `Contact: ${lead.name}` : lead.service}
                    </p>
                    {lead.companyName && <p className="text-zinc-500 text-xs">{lead.service}</p>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500">
                  {lead.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-4 h-4" />
                      {lead.phone}
                    </div>
                  )}
                  {lead.city && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      {lead.city}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {lead.createdAt?.seconds ? format(lead.createdAt.seconds * 1000, 'MMM d, yyyy') : 'Just now'}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAddingFollowUp(lead);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 text-orange-500 rounded-lg text-xs font-bold hover:bg-orange-500 hover:text-white transition-all"
                  >
                    <CalendarCheck className="w-3.5 h-3.5" />
                    Follow-up
                  </button>

                  <div className="flex items-center gap-1 bg-zinc-900 px-3 py-1.5 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span className="font-bold text-white">{lead.score}</span>
                  </div>
                  
                  <select 
                    value={lead.status}
                    onChange={(e) => updateStatus(lead.id, e.target.value as any)}
                    className="bg-zinc-900 border-none rounded-lg text-sm font-medium px-3 py-1.5 focus:ring-1 focus:ring-orange-500"
                  >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Converted">Converted</option>
                    <option value="Lost">Lost</option>
                  </select>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteLead(lead.id);
                    }}
                    className="p-2 text-zinc-500 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>

                  <div className="text-zinc-600">
                    {expandedLeadId === lead.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {expandedLeadId === lead.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mt-6 pt-6 border-t border-zinc-800">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead>
                            <tr className="text-zinc-500 border-b border-zinc-800">
                              <th className="pb-3 font-medium">Field</th>
                              <th className="pb-3 font-medium">Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/50">
                            <tr>
                              <td className="py-3 text-zinc-500">Lead ID</td>
                              <td className="py-3 font-mono text-xs text-zinc-300">{lead.id}</td>
                            </tr>
                            <tr>
                              <td className="py-3 text-zinc-500">Company Name</td>
                              <td className="py-3 text-zinc-300 font-medium">{lead.companyName || 'N/A'}</td>
                            </tr>
                            <tr>
                              <td className="py-3 text-zinc-500">Contact Person</td>
                              <td className="py-3 text-zinc-300">{lead.name}</td>
                            </tr>
                            <tr>
                              <td className="py-3 text-zinc-500">Service Requested</td>
                              <td className="py-3 text-zinc-300">{lead.service}</td>
                            </tr>
                            <tr>
                              <td className="py-3 text-zinc-500">Phone Number</td>
                              <td className="py-3 text-zinc-300">{lead.phone || 'Not provided'}</td>
                            </tr>
                            <tr>
                              <td className="py-3 text-zinc-500">Email Address</td>
                              <td className="py-3 text-zinc-300">{lead.email || 'Not provided'}</td>
                            </tr>
                            <tr>
                              <td className="py-3 text-zinc-500">City / Location</td>
                              <td className="py-3 text-zinc-300">{lead.city || 'Not provided'}</td>
                            </tr>
                            <tr>
                              <td className="py-3 text-zinc-500">Priority Level</td>
                              <td className="py-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  lead.priority === 'High' ? 'bg-red-500/20 text-red-500' :
                                  lead.priority === 'Medium' ? 'bg-orange-500/20 text-orange-500' :
                                  'bg-blue-500/20 text-blue-500'
                                }`}>
                                  {lead.priority}
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td className="py-3 text-zinc-500">AI Quality Score</td>
                              <td className="py-3 text-green-500 font-bold">{lead.score}/100</td>
                            </tr>
                            <tr>
                              <td className="py-3 text-zinc-500">Current Status</td>
                              <td className="py-3 text-zinc-300">{lead.status}</td>
                            </tr>
                            <tr>
                              <td className="py-3 text-zinc-500">Created At</td>
                              <td className="py-3 text-zinc-300">
                                {lead.createdAt?.seconds ? format(lead.createdAt.seconds * 1000, 'PPPP p') : 'Just now'}
                              </td>
                            </tr>
                            {lead.source && (
                              <tr>
                                <td className="py-3 text-zinc-500">Lead Source</td>
                                <td className="py-3 text-zinc-300">{lead.source}</td>
                              </tr>
                            )}
                            {lead.publishedDate && (
                              <tr>
                                <td className="py-3 text-zinc-500">Published Date</td>
                                <td className="py-3 text-zinc-300">{lead.publishedDate}</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {filteredLeads.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed border-zinc-800 rounded-3xl">
            <div className="flex justify-center mb-4">
              <AlertCircle className="w-12 h-12 text-zinc-700" />
            </div>
            <h3 className="text-xl font-medium text-zinc-400">No leads found</h3>
            <p className="text-zinc-600 mt-2">Try changing your filters or add new leads using the AI Finder.</p>
          </div>
        )}
      </div>

      {/* Quick Follow-up Modal */}
      <AnimatePresence>
        {isAddingFollowUp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0f0f0f] border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-xl font-bold">Schedule Follow-up</h3>
                <button onClick={() => setIsAddingFollowUp(null)} className="text-zinc-500 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 bg-zinc-900/50 border-b border-zinc-800">
                <p className="text-zinc-400 text-sm">Lead: <span className="text-white font-bold">{isAddingFollowUp.companyName || isAddingFollowUp.name}</span></p>
                {isAddingFollowUp.companyName && <p className="text-zinc-500 text-xs">Contact: {isAddingFollowUp.name}</p>}
                <p className="text-zinc-500 text-xs">{isAddingFollowUp.service}</p>
              </div>

              <form onSubmit={handleAddFollowUp} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Date</label>
                    <input
                      type="date"
                      required
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:ring-2 focus:ring-orange-500/50 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Time</label>
                    <input
                      type="time"
                      required
                      value={followUpTime}
                      onChange={(e) => setFollowUpTime(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:ring-2 focus:ring-orange-500/50 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Notes (Optional)</label>
                  <textarea
                    value={followUpNotes}
                    onChange={(e) => setFollowUpNotes(e.target.value)}
                    placeholder="e.g. Discuss GST filing requirements..."
                    className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:ring-2 focus:ring-orange-500/50 outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingFollowUp}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all mt-4"
                >
                  {isSubmittingFollowUp ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Schedule Task
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
