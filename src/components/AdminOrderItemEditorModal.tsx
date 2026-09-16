import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Edit3 } from 'lucide-react';
import OrderEditor, { OrderItem, EditableOrder, DynamicPricingConfig } from './OrderEditor';

export type { OrderItem, EditableOrder, DynamicPricingConfig };

export interface AdminOrderItemEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: EditableOrder | null;
  adminRole: 'admin' | 'master' | null;
  dynamicPricingConfig?: DynamicPricingConfig;
  onSave: (
    orderId: string, 
    updatedItems: OrderItem[], 
    updatedTotalPrice: number, 
    editNote?: string
  ) => Promise<void> | void;
}

export const AdminOrderItemEditorModal: React.FC<AdminOrderItemEditorModalProps> = ({
  isOpen,
  onClose,
  order,
  adminRole,
  dynamicPricingConfig,
  onSave
}) => {
  if (!isOpen || !order) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
        />

        {/* Modal Window Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="relative w-full max-w-3xl bg-white dark:bg-brand-dark rounded-3xl shadow-2xl border border-slate-200 dark:border-brand-teal/10 overflow-hidden z-10 flex flex-col max-h-[92vh]"
        >
          {/* Top Modal Header */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-brand-teal/10 flex items-center justify-between bg-slate-50/80 dark:bg-brand-deep/30 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-brand-accent">
                <Edit3 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-white font-mono">
                  Order Items & Rate Revision Editor
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Update quantities, service types, and add or remove garments with live dynamic recalculations
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-brand-deep/60 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body: Host reusable OrderEditor */}
          <div className="p-5 overflow-y-auto flex-1">
            <OrderEditor
              order={order}
              dynamicPricingConfig={dynamicPricingConfig}
              adminRole={adminRole}
              onSave={async (orderId, updatedItems, subtotal, finalTotalPrice, editNote) => {
                await onSave(orderId, updatedItems, finalTotalPrice, editNote);
              }}
              onCancel={onClose}
              isModalMode={true}
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AdminOrderItemEditorModal;
