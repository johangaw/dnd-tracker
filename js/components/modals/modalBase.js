// Shared close-button / backdrop-click wiring for modal web components.
// Each modal custom element is itself the `.modal` backdrop node (matching the
// existing markup convention), so closing means removing the "active" class
// from `root` itself.
export function setupModalClose(root, signal) {
    root.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => root.classList.remove('active'), { signal });
    });
    root.addEventListener('click', (e) => {
        if (e.target === root) root.classList.remove('active');
    }, { signal });
}
