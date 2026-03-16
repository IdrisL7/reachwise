"use client";

import { Download } from 'lucide-react';

const LeadsView = () => (
  <div className="p-8 bg-[#030014]">
    <div className="bg-[#0B0F1A] border border-white/5 rounded-2xl overflow-hidden">
      <div className="p-4 flex justify-between items-center border-b border-white/5">
        <h3 className="text-sm font-bold">Recent Leads</h3>
        <button className="bg-purple-600 px-4 py-2 rounded text-xs font-bold flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"><Download size={14}/> Import CSV</button>
      </div>
      <div className="divide-y divide-white/5">
        {[
          { name: 'Sarah Chen', company: 'Notion', status: 'Synced to HubSpot', color: 'text-orange-400' },
          { name: 'Marcus Aurelius', company: 'Stoic Inc', status: 'Ready to Send', color: 'text-purple-400' },
          { name: 'Elena Rodriguez', company: 'Linear', status: 'Synced to Salesforce', color: 'text-orange-400' },
          { name: 'James Wilson', company: 'Stripe', status: 'Draft Generated', color: 'text-blue-400' },
          { name: 'Alice Johnson', company: 'Vercel', status: 'Ready to Send', color: 'text-purple-400' },
          { name: 'David Kim', company: 'Ramp', status: 'Synced to HubSpot', color: 'text-orange-400' },
          { name: 'Maria Garcia', company: 'Figma', status: 'Awaiting Approval', color: 'text-yellow-400' },
          { name: 'Tom Chen', company: 'OpenAI', status: 'Ready to Send', color: 'text-purple-400' }
        ].map((lead, i) => (
          <div key={i} className="p-4 flex justify-between items-center text-sm hover:bg-white/[0.02] transition-colors">
            <div>
              <p className="font-bold">{lead.name}</p>
              <p className="text-xs text-slate-500">{lead.company}</p>
            </div>
            <div className={`text-[10px] font-black uppercase tracking-tighter ${lead.color}`}>{lead.status}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default function LeadsPage() {
  return <LeadsView />;
}