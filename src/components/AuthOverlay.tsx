"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AuthPanel } from "@/components/AuthPanel";

const EASE = [0.22, 1, 0.36, 1] as const;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AuthOverlay({ open, onClose }: Props) {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const armed = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      armed.current = false;
      return;
    }
    armed.current = false;
    const arm = window.setTimeout(() => {
      armed.current = true;
    }, 280);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(arm);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  function closeBackdrop() {
    if (armed.current) onClose();
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="dawn-auth"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#071018]/88 px-4 backdrop-blur-md sm:px-6"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="dawn-auth-title"
          onClick={closeBackdrop}
        >
          <motion.div
            className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--color-dawn)]/20 bg-[#0a121a] px-5 py-7 sm:px-8 sm:py-8"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.35, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-24 rounded-t-2xl bg-[radial-gradient(ellipse_at_top,rgba(240,180,90,0.22),transparent_70%)]"
            />
            <div className="relative">
              <h2 id="dawn-auth-title" className="sr-only">
                Sign in to Dawn
              </h2>
              <AuthPanel onClose={onClose} />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
