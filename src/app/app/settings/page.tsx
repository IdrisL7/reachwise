"use client";

const SettingsView = () => (
  <div className="p-8 max-w-2xl mx-auto space-y-12 bg-[#030014]">
    <section>
      <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-6">AI Context (The Brain)</h3>
      <div className="space-y-6 bg-[#0B0F1A] border border-white/5 p-8 rounded-2xl">
        <div>
          <label className="text-[10px] text-slate-600 font-black uppercase mb-2 block">Company Description</label>
          <textarea 
            className="w-full bg-[#030014] border border-white/10 rounded-xl p-4 text-sm min-h-[120px]" 
            defaultValue="We provide AI-powered outbound tools for B2B sales teams. Our platform generates personalized cold email hooks backed by real evidence and sources, helping sales reps book more meetings with higher response rates."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] text-slate-600 font-black uppercase mb-2 block">Voice Tone</label>
            <select className="w-full bg-[#030014] border border-white/10 p-4 rounded-xl text-sm">
              <option>Direct & Professional</option>
              <option>Friendly & Casual</option>
              <option>Formal & Corporate</option>
              <option>Conversational</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-600 font-black uppercase mb-2 block">Primary KPI</label>
            <select className="w-full bg-[#030014] border border-white/10 p-4 rounded-xl text-sm">
              <option>Book a Demo</option>
              <option>Schedule a Call</option>
              <option>Start a Trial</option>
              <option>Download Content</option>
            </select>
          </div>
        </div>
        <button className="w-full bg-purple-600 py-4 rounded-xl font-bold shadow-lg shadow-purple-500/20 hover:scale-[1.02] active:scale-[0.98]">Save AI Configuration</button>
      </div>
    </section>
    
    <section>
      <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-6">CRM Integrations</h3>
      <div className="bg-[#0B0F1A] border border-white/5 rounded-2xl p-8">
        <div className="space-y-4">
          {['HubSpot', 'Salesforce'].map(crm => (
            <div key={crm} className="bg-white/5 p-5 rounded-xl flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-800 rounded flex items-center justify-center font-bold text-xl">{crm[0]}</div>
                <p className="font-bold">{crm}</p>
              </div>
              <button className="bg-purple-600 px-6 py-2 rounded-lg text-xs font-bold shadow-lg shadow-purple-500/20 hover:scale-[1.02] active:scale-[0.98]">Connect</button>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section>
      <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-6">API Configuration</h3>
      <div className="bg-[#0B0F1A] border border-white/5 rounded-2xl p-8">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] text-slate-600 font-black uppercase mb-2 block">OpenAI API Key</label>
            <input 
              type="password" 
              className="w-full bg-[#030014] border border-white/10 rounded-xl p-4 text-sm" 
              placeholder="sk-..." 
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-600 font-black uppercase mb-2 block">Anthropic API Key</label>
            <input 
              type="password" 
              className="w-full bg-[#030014] border border-white/10 rounded-xl p-4 text-sm" 
              placeholder="sk-ant-..." 
            />
          </div>
          <button className="w-full bg-purple-600 py-4 rounded-xl font-bold shadow-lg shadow-purple-500/20 hover:scale-[1.02] active:scale-[0.98]">Save API Keys</button>
        </div>
      </div>
    </section>
  </div>
);

export default function SettingsPage() {
  return <SettingsView />;
}