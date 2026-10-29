"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ThemeToggle({ className }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={`size-9 rounded-lg ${className || ""}`}
        aria-label="Toggle theme"
      >
        <Sun className="size-4 text-foreground" />
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={`size-9 rounded-lg hover:bg-muted ${className || ""}`}
            aria-label="Toggle theme"
          />
        }
      >
        {theme === "dark" ? (
          <Sun className="size-4 text-foreground transition-transform hover:rotate-45" />
        ) : (
          <Moon className="size-4 text-foreground transition-transform hover:-rotate-12" />
        )}
      </TooltipTrigger>
      <TooltipContent>
        {theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      </TooltipContent>
    </Tooltip>
  );
}
