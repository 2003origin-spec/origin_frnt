'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, Trash2, X, Info, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications } from '@/context/NotificationContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<'right' | 'below'>('below');
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearAll } = useNotifications();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const openNotification = (id: string, href: string) => {
    markAsRead(id);
    setIsOpen(false);
    router.push(href);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // If there's room to the right (dropdown is 384px wide + 8px gap), open right
      setDropdownPos(rect.right + 392 <= window.innerWidth ? 'right' : 'below');
    }
    setIsOpen(prev => !prev);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default: return <Info className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        ref={buttonRef}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={handleToggle}
        className="p-2 text-muted-foreground hover:text-primary transition-colors relative bg-primary/10 rounded-full"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2.5 w-1.5 h-1.5 bg-primary rounded-full ring-2 ring-[hsl(var(--neu-bg))] motion-safe:animate-pulse" />
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "absolute w-80 sm:w-96 bg-[hsl(var(--neu-bg))] border border-border/50 rounded-2xl shadow-2xl overflow-hidden z-[100]",
              dropdownPos === 'right'
                ? "left-full ml-2 top-0"
                : "right-0 mt-2"
            )}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between bg-primary/5">
              <h3 className="font-black text-foreground flex items-center gap-2">
                Notifications
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full uppercase tracking-wider">
                    {unreadCount} New
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-primary/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {notifications.length > 0 ? (
                <div className="divide-y divide-border/30">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        "p-4 transition-all relative group cursor-default",
                        !notification.read ? "bg-primary/5" : "hover:bg-primary/5"
                      )}
                      onClick={() => !notification.read && markAsRead(notification.id)}
                    >
                      <div className="flex gap-3">
                        <div className="mt-1 flex-shrink-0">
                          {getTypeIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-bold leading-none mb-1",
                            !notification.read ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {notification.message}
                          </p>
                          <span className="text-[10px] text-muted-foreground/70 font-medium">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </span>
                          {notification.href && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openNotification(notification.id, notification.href!);
                              }}
                              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-primary/90"
                            >
                              {notification.href.startsWith('/ogcode/') ? 'Attempt now' : 'Open'}
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeNotification(notification.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-lg transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {!notification.read && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 px-4 text-center">
                  <div className="w-12 h-12 neu-inset rounded-full flex items-center justify-center mx-auto mb-3">
                    <Bell className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-bold text-foreground">All caught up!</p>
                  <p className="text-xs text-muted-foreground">No new notifications to show.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-border/40 bg-primary/5">
                <button
                  onClick={clearAll}
                  className="w-full py-2 text-xs text-muted-foreground hover:text-primary transition-colors font-bold rounded-lg hover:bg-primary/10"
                >
                  Clear all notifications
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
