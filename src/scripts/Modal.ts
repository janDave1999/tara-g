export function createConfirmModal({ message = "Are you sure?", confirmText = "Delete", cancelText = "Cancel", onConfirm: onConfirm }: { message?: string; confirmText?: string; cancelText?: string; onConfirm?: () => void }) {
  // Remove any existing modal first
  const existing = document.getElementById("dynamic-confirm-modal");
  if (existing) existing.remove();

  // Create modal container
  const modal = document.createElement("div");
  modal.id = "dynamic-confirm-modal";
  modal.className = "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm";

  // Modal content
  modal.innerHTML = `
    <div class="bg-white p-6 rounded-md shadow-lg m-4 max-w-sm w-full">
      <p class="text-md font-medium text-center mb-6">${message}</p>
      <div class="flex justify-center gap-4">
        <button id="modal-confirm" class="bg-green-100 text-green-700 px-4 py-2 rounded-md transition">${confirmText}</button>
        <button id="modal-cancel" class="bg-gray-100 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-400 transition">${cancelText}</button>
      </div>
    </div>
  `;

  // Append to body
  document.body.appendChild(modal);

  // Event handlers
  const confirmBtn = modal.querySelector("#modal-confirm") as HTMLButtonElement;
  const cancelBtn = modal.querySelector("#modal-cancel") as HTMLButtonElement;

  const closeModal = () => modal.remove();

  confirmBtn.addEventListener("click", () => {
    onConfirm?.();
    closeModal();
  });

  cancelBtn.addEventListener("click", closeModal);
}


type ConfirmModalOptions = {
  message: string;
  confirmText?: string;
  onConfirm?: () => void;
};

type MessageModalOptions = {
  message: string;
  autoClose?: boolean;
};

type ModalType = "confirm" | "success" | "error";

export function showConfirmModal(options: ConfirmModalOptions): void {
  showModal("confirm", options);
}

export function showSuccessModal(message: string): void {
    console.log("showSuccessModal", message);
  showModal("success", { message });
}

export function showErrorModal(message: string): void {
  showModal("error", { message });
}

function showModal(type: ModalType, options: ConfirmModalOptions | MessageModalOptions): void {
  const existing = document.getElementById("dynamic-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "dynamic-modal";
  modal.className = "fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50";

  const baseStyles = "p-6 rounded-md shadow-lg max-w-sm w-full text-center";

  let modalContent = "";

  if (type === "confirm") {
    const { message, confirmText = "Confirm" } = options as ConfirmModalOptions;
    modalContent = `
      <div class="bg-white ${baseStyles}">
        <p class="text-lg font-medium mb-6">${message}</p>
        <div class="flex justify-center gap-4">
          <button id="modal-confirm" class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition">${confirmText}</button>
          <button id="modal-cancel" class="bg-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-400 transition">Cancel</button>
        </div>
      </div>
    `;
  } else {
    const { message, autoClose = true } = options as MessageModalOptions;
    const bg = type === "success" ? "bg-green-100" : "bg-red-100";
    const text = type === "success" ? "text-green-800" : "text-red-800";

    modalContent = `
      <div class="${bg} ${baseStyles}">
        <p class="text-lg font-medium ${text}">${message}</p>
      </div>
    `;

    if (autoClose) {
      setTimeout(() => modal.remove(), 2500);
    }
  }

  modal.innerHTML = modalContent;
  document.body.appendChild(modal);

  // Bind events for confirm modal
  if (type === "confirm") {
    const { onConfirm } = options as ConfirmModalOptions;
    const confirmBtn = document.getElementById("modal-confirm") as HTMLButtonElement | null;
    const cancelBtn = document.getElementById("modal-cancel") as HTMLButtonElement | null;

    confirmBtn?.addEventListener("click", () => {
      onConfirm?.();
      modal.remove();
    });

    cancelBtn?.addEventListener("click", () => modal.remove());
  }
}
