"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="rounded-lg hover:bg-accent/20"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5 text-zinc-400 hover:text-zinc-200" />
      ) : (
        <Moon className="h-5 w-5 text-zinc-600 hover:text-zinc-900" />
      )}
    </Button>
  );
}
