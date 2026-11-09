export default function StudentProfileLoading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      <div className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50"></div>
      <div className="pg animate-pulse py-8">
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-3xl mb-6"></div>
        <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-2xl mb-6"></div>
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
      </div>
    </div>
  );
}
