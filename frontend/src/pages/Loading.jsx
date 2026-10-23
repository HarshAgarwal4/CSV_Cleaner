const FullScreenLoader = () => {
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-xs z-50 flex items-center justify-center">
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 border-3 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-3 text-sm text-slate-600 font-medium tracking-wide">
          Loading workspace...
        </p>
      </div>
    </div>
  );
};

export default FullScreenLoader;
