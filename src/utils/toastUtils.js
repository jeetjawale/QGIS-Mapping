// src/utils/toastUtils.js
import toast from "react-hot-toast";

export function showSuccess(message) {
  toast.success(message);
}
export function showError(message) {
  toast.error(message);
}
export function showInfo(message) {
  toast(message, { icon: "ℹ️" });
}
export function showCustom(message, icon) {
  toast(message, { icon });
}
export function showReviewDeleted() {
  toast("Review deleted.", { icon: "🗑️" });
}
