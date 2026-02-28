'use client';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
      {/* 911 Banner */}
      <a
        href="tel:911"
        className="fixed top-0 left-0 right-0 bg-red-700 text-white text-center py-2 font-bold text-lg z-50"
      >
        EMERGENCY? TAP TO CALL 911
      </a>

      <div className="mt-16 text-center max-w-md">
        <h1 className="text-3xl font-bold mb-4">Something went wrong</h1>
        <p className="text-slate-400 mb-8">
          We encountered an error. If you need immediate help, call 911.
        </p>
        <div className="space-y-4">
          <button
            onClick={() => reset()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition"
          >
            Try Again
          </button>
          <a
            href="/"
            className="block w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 px-6 rounded-xl transition text-center"
          >
            Return to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
