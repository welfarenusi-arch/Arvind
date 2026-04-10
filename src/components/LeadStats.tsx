import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  Clock,
  Target,
  Briefcase
} from 'lucide-react';

export default function LeadStats({ user }: { user: User }) {
  const [stats, setStats] = useState({
    total: 0,
    converted: 0,
    qualified: 0,
    new: 0,
    byService: [] as any[],
    byStatus: [] as any[]
  });

  useEffect(() => {
    const q = query(
      collection(db, 'leads'),
      where('ownerUid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leads = snapshot.docs.map(d => d.data());
      
      const serviceMap: Record<string, number> = {};
      const statusMap: Record<string, number> = {};
      
      leads.forEach(l => {
        serviceMap[l.service] = (serviceMap[l.service] || 0) + 1;
        statusMap[l.status] = (statusMap[l.status] || 0) + 1;
      });

      setStats({
        total: leads.length,
        converted: leads.filter(l => l.status === 'Converted').length,
        qualified: leads.filter(l => l.status === 'Qualified').length,
        new: leads.filter(l => l.status === 'New').length,
        byService: Object.entries(serviceMap).map(([name, value]) => ({ name, value })),
        byStatus: Object.entries(statusMap).map(([name, value]) => ({ name, value }))
      });
    });

    return () => unsubscribe();
  }, [user.uid]);

  const COLORS = ['#f97316', '#3b82f6', '#10b981', '#ef4444', '#a855f7'];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={<Briefcase className="text-orange-500" />} 
          label="Total Leads" 
          value={stats.total} 
          trend="+12%"
        />
        <StatCard 
          icon={<CheckCircle2 className="text-green-500" />} 
          label="Converted" 
          value={stats.converted} 
          trend="+5%"
        />
        <StatCard 
          icon={<Target className="text-blue-500" />} 
          label="Qualified" 
          value={stats.qualified} 
          trend="+8%"
        />
        <StatCard 
          icon={<Clock className="text-zinc-400" />} 
          label="New Enquiries" 
          value={stats.new} 
          trend="0%"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[#0f0f0f] border border-zinc-800 rounded-3xl p-6">
          <h3 className="font-bold text-lg mb-6">Leads by Service</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byService}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#71717a" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#71717a" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0f0f0f] border border-zinc-800 rounded-3xl p-6">
          <h3 className="font-bold text-lg mb-6">Conversion Status</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.byStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.byStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, trend }: { icon: React.ReactNode, label: string, value: number, trend: string }) {
  return (
    <div className="bg-[#0f0f0f] border border-zinc-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center">
          {icon}
        </div>
        <span className="text-xs font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded-lg">
          {trend}
        </span>
      </div>
      <p className="text-zinc-500 text-sm font-medium">{label}</p>
      <h4 className="text-3xl font-bold mt-1">{value}</h4>
    </div>
  );
}
