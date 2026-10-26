export default function ClassDetailsLoading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      <div className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50"></div>
      <div className="pg animate-pulse">
        <div className="h-40 bg-blue-500/20 rounded-3xl"></div>
        <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
        <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
      </div>
    </div>
  );
}
