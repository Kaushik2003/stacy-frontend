import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export default function SettingsDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-[101] overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-100">Settings</h2>
              <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Editor</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-800">
                    <div>
                      <p className="text-sm text-zinc-200">Font Size</p>
                      <p className="text-xs text-zinc-500">Editor font size in pixels</p>
                    </div>
                    <select className="bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-xs text-zinc-300">
                      <option>12px</option>
                      <option>13px</option>
                      <option>14px</option>
                      <option>16px</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-800">
                    <div>
                      <p className="text-sm text-zinc-200">Tab Size</p>
                      <p className="text-xs text-zinc-500">Spaces per tab</p>
                    </div>
                    <select className="bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-xs text-zinc-300">
                      <option>2</option>
                      <option>4</option>
                      <option>8</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">AI Assistant</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-800">
                    <div>
                      <p className="text-sm text-zinc-200">Default Model</p>
                      <p className="text-xs text-zinc-500">Preferred AI model</p>
                    </div>
                    <select className="bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-xs text-zinc-300">
                      <option>Gemini Pro</option>
                      <option>Claude Sonnet</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-800">
                    <div>
                      <p className="text-sm text-zinc-200">Auto-complete</p>
                      <p className="text-xs text-zinc-500">Enable AI code suggestions</p>
                    </div>
                    <button className="w-10 h-5 bg-purple-600 rounded-full relative">
                      <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Appearance</h3>
                <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-800">
                  <div>
                    <p className="text-sm text-zinc-200">Theme</p>
                    <p className="text-xs text-zinc-500">Application color scheme</p>
                  </div>
                  <select className="bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-xs text-zinc-300">
                    <option>Dark</option>
                    <option>Light</option>
                    <option>System</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-zinc-800 flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
                Cancel
              </button>
              <button className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded-lg transition-colors">
                Save Changes
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}