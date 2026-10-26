export default function RegisterLoading() {
  return (
    <div className="min-h-screen py-16 px-4 grid place-items-center">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 animate-pulse">
        <div className="h-8 w-44 bg-slate-200 dark:bg-slate-800 rounded-full mb-3"></div>
        <div className="h-4 w-60 bg-slate-200 dark:bg-slate-800 rounded-full mb-8"></div>
        <div className="space-y-4">
          <div className="h-12 w-full bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-12 w-full bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-12 w-full bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-12 w-full bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-12 w-full bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
        </div>
        <div className="h-14 w-full bg-blue-500/30 rounded-full mt-6"></div>
      </div>
    </div>
  );
}
