import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";


export default function AccountDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 dark:bg-black/40 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-2xl z-[101] overflow-hidden transition-colors duration-300"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-black dark:text-zinc-100">Account</h2>
              <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md text-gray-600 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                  <span className="text-2xl text-purple-400 font-bold">KZ</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-black dark:text-zinc-100">Kzark</h3>
                  <p className="text-sm text-gray-600 dark:text-zinc-500">kzark@example.com</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-gray-100 dark:bg-zinc-800/50 rounded-lg border border-gray-200 dark:border-zinc-800">
                  <label className="text-[10px] text-gray-600 dark:text-zinc-500 uppercase tracking-wider">Plan</label>
                  <p className="text-sm text-black dark:text-zinc-200 mt-1">Pro Developer</p>
                </div>
                <div className="p-3 bg-gray-100 dark:bg-zinc-800/50 rounded-lg border border-gray-200 dark:border-zinc-800">
                  <label className="text-[10px] text-gray-600 dark:text-zinc-500 uppercase tracking-wider">API Usage</label>
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-600 dark:text-zinc-400 mb-1">
                      <span>1,234 / 10,000 requests</span>
                      <span>12%</span>
                    </div>
                    <div className="h-1.5 bg-gray-300 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div className="h-full w-[12%] bg-purple-500 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 h-9 bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 text-black dark:text-zinc-300 text-xs font-medium rounded-lg transition-colors">
                  Manage Subscription
                </button>
                <button className="flex-1 h-9 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium rounded-lg transition-colors border border-red-500/30">
                  Sign Out
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
