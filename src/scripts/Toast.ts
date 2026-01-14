export type ToastType = "info" | "success" | "error" | "warning";

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number; // in milliseconds
}

const iconMap: Record<ToastType, string> = {
  info: `
    <svg class="shrink-0 w-5 h-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
      <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
    </svg>
  `,
  success: `
    <svg class="shrink-0 w-5 h-5 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
      <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
    </svg>
  `,
  error: `
    <svg class="shrink-0 w-5 h-5 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
      <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/>
    </svg>
  `,
  warning: `
    <svg class="shrink-0 w-5 h-5 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
      <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8 4a.905.905 0 0 0-.9.995l.35 3.507a.552.552 0 0 0 1.1 0l.35-3.507A.905.905 0 0 0 8 4zm.002 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
    </svg>
  `
};

const bgColorMap: Record<ToastType, string> = {
  info: "bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200",
  success: "bg-gradient-to-br from-green-50 to-emerald-50 border-green-200",
  error: "bg-gradient-to-br from-red-50 to-pink-50 border-red-200",
  warning: "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200"
};

const textColorMap: Record<ToastType, string> = {
  info: "text-blue-800",
  success: "text-green-800",
  error: "text-red-800",
  warning: "text-amber-800"
};

export function showToast({ message, type = "info", duration = 3000 }: ToastOptions): void {
  const containerId = "toast-container";
  let container = document.getElementById(containerId);

  // Create container if it doesn't exist
  if (!container) {
    container = document.createElement("div");
    container.id = containerId;
    // FIXED: Proper z-index and positioning - always on top
    container.className = "fixed top-20 right-4 z-[9999] space-y-3 pointer-events-none";
    container.style.zIndex = "9999"; // Extra safety
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  const bgColor = bgColorMap[type];
  const textColor = textColorMap[type];
  
  // Enable pointer events on individual toasts for close button
  toast.className = `max-w-xs w-full ${bgColor} border-2 rounded-xl shadow-2xl pointer-events-auto transform transition-all duration-300 ease-out`;
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", "polite");
  toast.tabIndex = -1;

  const iconHTML = iconMap[type];

  toast.innerHTML = `
    <div class="flex items-start p-4 gap-3">
      <div class="shrink-0 mt-0.5">${iconHTML}</div>
      <div class="flex-1">
        <p class="text-sm font-medium ${textColor} leading-relaxed">${message}</p>
      </div>
      <button 
        class="shrink-0 ml-2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 rounded"
        onclick="this.closest('[role=alert]').remove()"
        aria-label="Close notification"
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
        </svg>
      </button>
    </div>
  `;

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateX(0)";
    });
  });

  // Auto-dismiss
  const timeoutId = setTimeout(() => {
    dismissToast(toast, container);
  }, duration);

  // Cancel auto-dismiss on hover
  toast.addEventListener("mouseenter", () => {
    clearTimeout(timeoutId);
  });

  // Resume auto-dismiss on mouse leave
  toast.addEventListener("mouseleave", () => {
    setTimeout(() => {
      dismissToast(toast, container);
    }, 1000);
  });
}

function dismissToast(toast: HTMLElement, container: HTMLElement | null): void {
  // Animate out
  toast.style.opacity = "0";
  toast.style.transform = "translateX(100%)";
  
  setTimeout(() => {
    toast.remove();
    // Clean up container if empty
    if (container && container.childElementCount === 0) {
      container.remove();
    }
  }, 300);
}

// Add required CSS (call this once on app init or include in global styles)
export function injectToastStyles(): void {
  if (document.getElementById("toast-styles")) return;

  const style = document.createElement("style");
  style.id = "toast-styles";
  style.textContent = `
    #toast-container > div {
      animation: slideInRight 0.3s ease-out;
    }

    @keyframes slideInRight {
      from {
        opacity: 0;
        transform: translateX(100%);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    /* Ensure toasts stack properly */
    #toast-container {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    /* Mobile responsive */
    @media (max-width: 640px) {
      #toast-container {
        left: 1rem;
        right: 1rem;
        top: 5rem;
      }
      
      #toast-container > div {
        max-width: 100%;
      }
    }
  `;
  document.head.appendChild(style);
}

// Auto-inject styles when module loads
if (typeof document !== "undefined") {
  injectToastStyles();
}