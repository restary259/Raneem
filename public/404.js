// Preserve the full URL including query parameters.
const fullPath = window.location.pathname + window.location.search + window.location.hash;
window.sessionStorage.setItem("redirectPath", fullPath);
window.location.replace(`${window.location.protocol}//${window.location.host}/`);
