export default function VerifyOtpLoading() {
  return (
    <div className="min-h-screen grid place-items-center p-6 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center animate-pulse">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-200 dark:bg-slate-800"></div>
        <div className="h-6 w-44 mx-auto bg-slate-200 dark:bg-slate-800 rounded-full mb-3"></div>
        <div className="h-4 w-64 mx-auto bg-slate-200 dark:bg-slate-800 rounded-full mb-8"></div>
        <div className="h-14 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl mb-6"></div>
        <div className="h-12 w-full bg-blue-500/30 rounded-full"></div>
      </div>
    </div>
  );
}
