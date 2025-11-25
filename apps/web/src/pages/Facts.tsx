import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Loader2, Pin, PinOff, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type Fact = {
  id: string;
  familyId: string;
  entityId: string;
  domain: 'MEDICAL' | 'FINANCIAL' | 'ESTATE' | 'WELLBEING';
  entityType: string;
  key: string;
  value: any;
  status: 'PROPOSED' | 'ACTIVE' | 'REJECTED' | 'SUPERSEDED';
  pinned: boolean;
  confidence: number;
  entity?: { id: string; displayName?: string; type?: string };
  sources?: Array<{ id: string; sourceType: string; sourceId: string; section?: string }>;
  updatedAt: string;
};

export function Facts() {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [status, setStatus] = useState<'PROPOSED'|'ACTIVE'|'REJECTED'|'SUPERSEDED'|'all'>('PROPOSED');
  const [domain, setDomain] = useState<'all'|'MEDICAL'|'FINANCIAL'|'ESTATE'|'WELLBEING'>('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchFacts(); }, [status, domain, q]);

  const fetchFacts = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      if (domain !== 'all') params.set('domain', domain);
      if (q) params.set('q', q);
      const res = await api.get(`/api/v1/facts?${params.toString()}`);
      setFacts(res.data.facts || []);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Failed to load facts');
    } finally {
      setLoading(false);
    }
  };

  const togglePin = async (fact: Fact) => {
    try {
      const res = await api.patch(`/api/v1/facts/${fact.id}`, { pinned: !fact.pinned });
      setFacts((prev) => prev.map(f => f.id === fact.id ? { ...f, pinned: res.data.fact.pinned } : f));
    } catch {}
  };

  const setActive = async (fact: Fact) => {
    try {
      const res = await api.patch(`/api/v1/facts/${fact.id}`, { status: 'ACTIVE' });
      setFacts((prev) => prev.map(f => f.id === fact.id ? { ...f, status: res.data.fact.status } : f));
    } catch {}
  };

  const reject = async (fact: Fact) => {
    try {
      const res = await api.patch(`/api/v1/facts/${fact.id}`, { status: 'REJECTED' });
      setFacts((prev) => prev.map(f => f.id === fact.id ? { ...f, status: res.data.fact.status } : f));
    } catch {}
  };

  const updateValue = async (fact: Fact, newValue: any) => {
    try {
      const res = await api.patch(`/api/v1/facts/${fact.id}`, { value: newValue, status: 'ACTIVE' });
      setFacts((prev) => prev.map(f => f.id === fact.id ? { ...f, value: res.data.fact.value, status: 'ACTIVE' } : f));
    } catch {}
  };

  const filtered = useMemo(() => facts, [facts]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Fact Review</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Review, confirm, and pin key facts for chat context</p>
        </div>
      </div>

      <div className="card dark:bg-slate-800 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search entity, key, value" className="w-full pl-9 pr-3 py-2 border-2 border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-700 dark:text-gray-100 dark:placeholder-gray-400" />
          </div>
          <select value={status} onChange={(e)=>setStatus(e.target.value as any)} className="px-3 py-2 border-2 border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-gray-100">
            <option value="PROPOSED">Proposed</option>
            <option value="ACTIVE">Active</option>
            <option value="REJECTED">Rejected</option>
            <option value="SUPERSEDED">Superseded</option>
            <option value="all">All</option>
          </select>
          <select value={domain} onChange={(e)=>setDomain(e.target.value as any)} className="px-3 py-2 border-2 border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-gray-100">
            <option value="all">All domains</option>
            <option value="MEDICAL">Medical</option>
            <option value="FINANCIAL">Financial</option>
            <option value="ESTATE">Estate</option>
            <option value="WELLBEING">Wellbeing</option>
          </select>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">{error}</div>}
      {loading ? (
        <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary-600 dark:text-primary-400" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="card dark:bg-slate-800 dark:border-slate-700 text-center text-gray-500 dark:text-gray-400">No facts found</div>
          ) : (
            filtered.map((f) => (
              <div key={f.id} className="card-compact dark:bg-slate-800 border-2 dark:border-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{f.domain} - {f.entityType}</div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">{f.entity?.displayName || f.entityId}</div>
                    <div className="text-sm text-gray-700 dark:text-gray-300 mt-1 break-words"><span className="font-mono text-xs bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded">{f.key}</span></div>
                  </div>
                  <button onClick={() => togglePin(f)} className={cn('p-2 rounded-lg border', f.pinned ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-700' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 border-gray-200 dark:border-slate-600')}>{f.pinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}</button>
                </div>
                <div className="mt-2">
                  <textarea defaultValue={JSON.stringify(f.value, null, 2)} onBlur={(e)=> {
                    try { updateValue(f, JSON.parse(e.target.value)); } catch {}
                  }} className="w-full border dark:border-slate-600 rounded-lg text-xs p-2 font-mono bg-white dark:bg-slate-700 dark:text-gray-100" rows={4} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {f.status !== 'ACTIVE' && (
                    <button onClick={()=>setActive(f)} className="px-3 py-1 rounded bg-green-600 dark:bg-green-500 text-white text-xs hover:bg-green-700 dark:hover:bg-green-600">Confirm</button>
                  )}
                  {f.status !== 'REJECTED' && (
                    <button onClick={()=>reject(f)} className="px-3 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs hover:bg-red-200 dark:hover:bg-red-900/50">Reject</button>
                  )}
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">Confidence {(f.confidence*100).toFixed(0)}%</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default Facts;

