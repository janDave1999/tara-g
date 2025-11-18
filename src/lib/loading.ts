const modal = () => document.getElementById("loadingModal");

export const showLoading = () => modal()?.classList.remove("hidden");
export const hideLoading = () => modal()?.classList.add("hidden");
