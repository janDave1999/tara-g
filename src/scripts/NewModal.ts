// ===== Types =====
type ModalVariant = 'confirm' | 'success' | 'error' | 'warning' | 'info';

type BaseModalOptions = {
  message: string;
  title?: string;
  autoClose?: boolean;
  autoCloseDuration?: number;
  onClose?: () => void;
};

type ConfirmModalOptions = BaseModalOptions & {
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmVariant?: 'danger' | 'primary' | 'success';
};

type MessageModalOptions = BaseModalOptions;

// ===== Modal Configuration =====
const MODAL_STYLES = {
  variants: {
    confirm: {
      bg: 'bg-white',
      text: 'text-slate-800',
      icon: `
        <svg class="w-12 h-12 mx-auto mb-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      `
    },
    success: {
      bg: 'bg-emerald-50 border border-emerald-200',
      text: 'text-emerald-800',
      icon: `
        <svg class="w-12 h-12 mx-auto mb-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      `
    },
    error: {
      bg: 'bg-red-50 border border-red-200',
      text: 'text-red-800',
      icon: `
        <svg class="w-12 h-12 mx-auto mb-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      `
    },
    warning: {
      bg: 'bg-amber-50 border border-amber-200',
      text: 'text-amber-800',
      icon: `
        <svg class="w-12 h-12 mx-auto mb-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      `
    },
    info: {
      bg: 'bg-blue-50 border border-blue-200',
      text: 'text-blue-800',
      icon: `
        <svg class="w-12 h-12 mx-auto mb-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      `
    }
  },
  buttons: {
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    secondary: 'bg-slate-200 hover:bg-slate-300 text-slate-800'
  }
};

// ===== Modal Manager Class =====
class ModalManager {
  private modals: Map<string, HTMLDivElement> = new Map();
  private modalCounter = 0;

  private createModalContainer(id: string): HTMLDivElement {
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200';
    return modal;
  }

  private removeModal(id: string): void {
    const modal = this.modals.get(id);
    if (modal) {
      modal.classList.add('animate-out', 'fade-out', 'duration-150');
      setTimeout(() => {
        modal.remove();
        this.modals.delete(id);
      }, 150);
    }
  }

  showConfirm(options: ConfirmModalOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const id = `modal-confirm-${this.modalCounter++}`;
      const modal = this.createModalContainer(id);

      const {
        message,
        title,
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        confirmVariant = 'danger',
        onConfirm,
        onCancel,
        onClose
      } = options;

      const variant = MODAL_STYLES.variants.confirm;
      const confirmBtnStyle = MODAL_STYLES.buttons[confirmVariant];
      const cancelBtnStyle = MODAL_STYLES.buttons.secondary;

      modal.innerHTML = `
        <div class="${variant.bg} rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 animate-in zoom-in duration-200">
          ${variant.icon}
          ${title ? `<h3 class="text-lg font-bold ${variant.text} mb-2 text-center">${title}</h3>` : ''}
          <p class="text-sm ${variant.text} mb-6 text-center">${message}</p>
          <div class="flex justify-center gap-3">
            <button data-action="confirm" class="px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${confirmBtnStyle}">
              ${confirmText}
            </button>
            <button data-action="cancel" class="px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${cancelBtnStyle}">
              ${cancelText}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      this.modals.set(id, modal);

      const confirmBtn = modal.querySelector('[data-action="confirm"]') as HTMLButtonElement;
      const cancelBtn = modal.querySelector('[data-action="cancel"]') as HTMLButtonElement;

      const handleConfirm = () => {
        onConfirm?.();
        onClose?.();
        this.removeModal(id);
        resolve(true);
      };

      const handleCancel = () => {
        onCancel?.();
        onClose?.();
        this.removeModal(id);
        resolve(false);
      };

      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', handleCancel);

      // Close on backdrop click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) handleCancel();
      });

      // Close on Escape key
      const escapeHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleCancel();
          document.removeEventListener('keydown', escapeHandler);
        }
      };
      document.addEventListener('keydown', escapeHandler);
    });
  }

  showMessage(variant: Exclude<ModalVariant, 'confirm'>, options: MessageModalOptions): void {
    const id = `modal-${variant}-${this.modalCounter++}`;
    const modal = this.createModalContainer(id);

    const {
      message,
      title,
      autoClose = true,
      autoCloseDuration = 2500,
      onClose
    } = options;

    const style = MODAL_STYLES.variants[variant];

    modal.innerHTML = `
      <div class="${style.bg} rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 animate-in zoom-in duration-200">
        ${style.icon}
        ${title ? `<h3 class="text-lg font-bold ${style.text} mb-2 text-center">${title}</h3>` : ''}
        <p class="text-sm ${style.text} text-center">${message}</p>
      </div>
    `;

    document.body.appendChild(modal);
    this.modals.set(id, modal);

    const closeModal = () => {
      onClose?.();
      this.removeModal(id);
    };

    // Auto close
    if (autoClose) {
      setTimeout(closeModal, autoCloseDuration);
    }

    // Close on click
    modal.addEventListener('click', closeModal);

    // Close on Escape
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }

  showSuccess(message: string, options?: Partial<MessageModalOptions>): void {
    this.showMessage('success', { message, ...options });
  }

  showError(message: string, options?: Partial<MessageModalOptions>): void {
    this.showMessage('error', { message, autoClose: false, ...options });
  }

  showWarning(message: string, options?: Partial<MessageModalOptions>): void {
    this.showMessage('warning', { message, ...options });
  }

  showInfo(message: string, options?: Partial<MessageModalOptions>): void {
    this.showMessage('info', { message, ...options });
  }

  closeAll(): void {
    this.modals.forEach((_, id) => this.removeModal(id));
  }
}

// ===== Export Singleton Instance =====
export const modal = new ModalManager();

// ===== Convenience Functions (for backward compatibility) =====
export function showConfirmModal(options: ConfirmModalOptions): Promise<boolean> {
  return modal.showConfirm(options);
}

export function showSuccessModal(message: string, options?: Partial<MessageModalOptions>): void {
  modal.showSuccess(message, options);
}

export function showErrorModal(message: string, options?: Partial<MessageModalOptions>): void {
  modal.showError(message, options);
}

export function showWarningModal(message: string, options?: Partial<MessageModalOptions>): void {
  modal.showWarning(message, options);
}

export function showInfoModal(message: string, options?: Partial<MessageModalOptions>): void {
  modal.showInfo(message, options);
}

// Legacy support for createConfirmModal
export function createConfirmModal(options: {
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
}): void {
  modal.showConfirm({
    message: options.message || 'Are you sure?',
    confirmText: options.confirmText || 'Delete',
    cancelText: options.cancelText || 'Cancel',
    onConfirm: options.onConfirm,
    confirmVariant: 'danger'
  });
}