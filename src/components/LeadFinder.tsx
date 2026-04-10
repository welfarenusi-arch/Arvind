import { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { db, auth } from '../firebase';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  getDoc, 
  doc,
  getDocFromServer
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { 
  Sparkles, 
  Clipboard, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  ArrowRight,
  Copy,
  Search,
  Globe,
  MessageSquare,
  Share2,
  Link
} from 'lucide-react';
import { motion } from 'motion/react';

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

export default function LeadFinder({ user }: { user: User }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [mode, setMode] = useState<'search' | 'extract' | 'url'>('search');

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
          setError("Firebase is offline. Please check your connection or configuration.");
        }
      }
    }
    testConnection();
  }, []);

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
    setError(`Firestore Error: ${errInfo.error}`);
    throw new Error(JSON.stringify(errInfo));
  };

  const findLeads = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      let prompt = '';
      let tools: any[] = [];

      if (mode === 'search') {
        prompt = `Search for potential business leads based on the query: "${input}". 
           You MUST search across these specific platforms for the most recent requirements:
           1. Business Directories: Just Dial, IndiaMART, Sulekha, TradeIndia.
           2. Social Media: LinkedIn (posts/profiles), Facebook Groups (business/service groups), Instagram.
           3. Forums & Communities: Reddit India (r/India, r/IndiaInvestments), Quora India, IndiaFilings forum.
           4. Portals: Startup India.
           5. Search Engines: Google Search.
           
           CRITICAL: You MUST prioritize finding valid phone numbers and email addresses. 
           If you find a business name but no contact info, perform a secondary search for "[Business Name] contact details" or "[Business Name] official website" to extract them.
           Focus on people or businesses looking for services like GST, MSME, Trademark, ISO, Company Registration, etc.
           Return a JSON array of objects with fields: name (contact person), companyName, phone, email, city, service, businessType, intent, priority (High/Medium/Low), score (0-100), sourceUrl, source (e.g. LinkedIn, Just Dial), publishedDate (e.g. 2024-03-20).`;
        tools = [{ googleSearch: {} }];
      } else if (mode === 'extract') {
        prompt = `Extract business leads from the following text. 
           CRITICAL: Identify and extract ALL phone numbers and email addresses present.
           Focus on requirements for services like GST, MSME, Trademark, ISO, Company Registration, etc.
           Return a JSON array of objects with fields: name (contact person), companyName, phone, email, city, service, businessType, intent, priority (High/Medium/Low), score (0-100), source (e.g. Facebook Post), publishedDate.
           
           Text: ${input}`;
      } else if (mode === 'url') {
        prompt = `Scrape and extract business leads from the provided URL: ${input}.
           CRITICAL: Deep dive into the page content to find ANY phone numbers, email addresses, or contact details.
           Look for "Contact Us", "About", or footer sections if needed.
           Focus on requirements for services like GST, MSME, Trademark, ISO, Company Registration, etc.
           Return a JSON array of objects with fields: name (contact person), companyName, phone, email, city, service, businessType, intent, priority (High/Medium/Low), score (0-100), sourceUrl, source (e.g. IndiaMART), publishedDate.`;
        tools = [{ urlContext: {} }];
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          tools,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Contact person name" },
                companyName: { type: Type.STRING, description: "Business or company name" },
                phone: { type: Type.STRING },
                email: { type: Type.STRING },
                city: { type: Type.STRING },
                service: { type: Type.STRING },
                businessType: { type: Type.STRING },
                intent: { type: Type.STRING },
                priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
                score: { type: Type.NUMBER },
                sourceUrl: { type: Type.STRING },
                source: { type: Type.STRING, description: "The platform or source name" },
                publishedDate: { type: Type.STRING, description: "Date when the lead was published" }
              },
              required: ["name", "service", "priority", "score"]
            }
          }
        }
      });

      const data = JSON.parse(response.text || '[]');
      setResults(data);
    } catch (err) {
      console.error(err);
      setError('Failed to find leads. Please check your API key or try a different query.');
    } finally {
      setLoading(false);
    }
  };

  const saveLead = async (lead: any, index: number) => {
    const score = lead.score !== undefined ? lead.score : 50;
    const leadToSave = { ...lead, score };
    const path = 'leads';

    try {
      await addDoc(collection(db, path), {
        ...leadToSave,
        status: 'New',
        ownerUid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        rawText: input
      });

      // Check notification preferences
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const prefs = userDoc.data()?.notificationPrefs;

      if (prefs?.emailEnabled && score >= (prefs.minScore || 0)) {
        try {
          await fetch('/api/notify-lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userEmail: user.email,
              leadName: leadToSave.name,
              service: leadToSave.service,
              score: score
            })
          });
        } catch (err) {
          console.error('Failed to trigger email notification:', err);
        }
      }

      if (prefs?.whatsappEnabled && score >= (prefs.minScore || 0)) {
        try {
          await fetch('/api/notify-whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userEmail: user.email,
              leadName: leadToSave.name,
              service: leadToSave.service,
              score: score,
              phone: leadToSave.phone
            })
          });
        } catch (err) {
          console.error('Failed to trigger WhatsApp notification:', err);
        }
      }
      
      const newResults = [...results];
      newResults[index] = { ...leadToSave, saved: true };
      setResults(newResults);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const copyToClipboard = (lead: any, index: number) => {
    const details = `Company: ${lead.companyName || 'N/A'}\nContact Name: ${lead.name}\nPhone: ${lead.phone || 'N/A'}\nEmail: ${lead.email || 'N/A'}\nCity: ${lead.city || 'N/A'}\nService: ${lead.service}`;
    navigator.clipboard.writeText(details);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="bg-[#0f0f0f] border border-zinc-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
                {mode === 'search' ? <Search className="w-5 h-5 text-orange-500" /> : mode === 'url' ? <Link className="w-5 h-5 text-orange-500" /> : <Clipboard className="w-5 h-5 text-orange-500" />}
              </div>
              <div>
                <h3 className="font-bold text-lg">
                  {mode === 'search' ? 'AI Lead Search' : mode === 'url' ? 'URL Scraper' : 'Lead Extractor'}
                </h3>
                <p className="text-zinc-500 text-sm">
                  {mode === 'search' ? 'Search across directories & social media.' : mode === 'url' ? 'Scrape leads directly from a website URL.' : 'Paste text to extract lead details.'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex p-1 bg-zinc-900 rounded-xl mb-4">
            <button
              onClick={() => setMode('search')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${
                mode === 'search' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Search Web
            </button>
            <button
              onClick={() => setMode('url')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${
                mode === 'url' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Scrape URL
            </button>
            <button
              onClick={() => setMode('extract')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${
                mode === 'extract' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Extract Text
            </button>
          </div>
          
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === 'search' 
              ? "Example: 'Find people looking for GST registration in Delhi' or 'Small businesses needing Trademark help in Bangalore'"
              : mode === 'url'
              ? "Example: 'https://www.justdial.com/Mumbai/GST-Registration-Consultants/nct-11223344'"
              : "Example: 'I am looking for a GST registration consultant in Mumbai...'"
            }
            className="w-full h-48 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 text-zinc-200 placeholder:text-zinc-600 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all resize-none"
          />
          
          <button
            onClick={findLeads}
            disabled={loading || !input.trim()}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                {mode === 'search' ? 'Search Leads with AI' : mode === 'url' ? 'Scrape URL with AI' : 'Extract Leads with AI'}
              </>
            )}
          </button>
          
          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-500/10 p-3 rounded-xl">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        <div className="bg-zinc-900/30 border border-zinc-800 rounded-3xl p-6">
          <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">
            {mode === 'search' ? 'Platforms Searched' : mode === 'url' ? 'URL Scraping Info' : 'Pro Tips'}
          </h4>
          {mode === 'search' ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Globe className="w-3 h-3 text-orange-500" />
                Just Dial, IndiaMART, Sulekha, TradeIndia
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Share2 className="w-3 h-3 text-orange-500" />
                LinkedIn, Facebook, Instagram
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <MessageSquare className="w-3 h-3 text-orange-500" />
                Reddit, Quora, Google Search
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Sparkles className="w-3 h-3 text-orange-500" />
                Startup India
              </div>
            </div>
          ) : mode === 'url' ? (
            <ul className="space-y-3 text-sm text-zinc-400">
              <li className="flex gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                Enter a direct URL to a business directory or profile page.
              </li>
              <li className="flex gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                The AI will deep-scrape contact info, emails, and phone numbers.
              </li>
            </ul>
          ) : (
            <ul className="space-y-3 text-sm text-zinc-400">
              <li className="flex gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                Paste multiple posts at once to batch process leads.
              </li>
              <li className="flex gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                The AI automatically scores leads based on intent and contact info.
              </li>
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xl">Extracted Results ({results.length})</h3>
          {results.length > 0 && (
            <button 
              onClick={() => setResults([])}
              className="text-xs font-bold text-zinc-500 hover:text-white uppercase tracking-widest"
            >
              Clear
            </button>
          )}
        </div>

        <div className="space-y-4">
          {results.map((lead, i) => (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              key={i}
              className="bg-[#0f0f0f] border border-zinc-800 rounded-2xl p-5 group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4">
                <div className={`text-xs font-bold px-2 py-1 rounded ${
                  lead.priority === 'High' ? 'bg-red-500/20 text-red-500' :
                  lead.priority === 'Medium' ? 'bg-orange-500/20 text-orange-500' :
                  'bg-blue-500/20 text-blue-500'
                }`}>
                  {lead.priority}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h4 className="font-bold text-lg">{lead.companyName || lead.name}</h4>
                  {lead.companyName && <p className="text-zinc-400 text-sm">Contact: {lead.name}</p>}
                  <p className="text-orange-500 text-sm font-medium">{lead.service}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-zinc-500 text-xs uppercase font-bold">Contact</p>
                    <p className="text-zinc-300 truncate">{lead.phone || lead.email || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-zinc-500 text-xs uppercase font-bold">Location</p>
                    <p className="text-zinc-300">{lead.city || 'N/A'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-zinc-500 text-xs uppercase font-bold">Source</p>
                    <p className="text-zinc-300">{lead.source || 'AI Search'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-zinc-500 text-xs uppercase font-bold">Published</p>
                    <p className="text-zinc-300">{lead.publishedDate || 'N/A'}</p>
                  </div>
                </div>

                {lead.sourceUrl && (
                  <div className="text-[10px] text-zinc-600 truncate">
                    Source: <a href={lead.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">{lead.sourceUrl}</a>
                  </div>
                )}

                <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Score</div>
                    <div className="w-12 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500" 
                        style={{ width: `${lead.score}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-white">{lead.score}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(lead, i)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-all"
                    >
                      {copiedIndex === i ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy Details
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => saveLead(lead, i)}
                      disabled={lead.saved}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                        lead.saved 
                          ? 'bg-green-500/10 text-green-500' 
                          : 'bg-white text-black hover:bg-zinc-200'
                      }`}
                    >
                      {lead.saved ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Saved
                        </>
                      ) : (
                        <>
                          Save to CRM
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {results.length === 0 && !loading && (
            <div className="h-64 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center text-zinc-600">
              <Sparkles className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-medium">AI results will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
