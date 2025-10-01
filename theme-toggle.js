// Simple theme toggle: sets html[data-theme="dark"] and persists in localStorage
document.addEventListener('DOMContentLoaded', function () {
	const root = document.documentElement;
	const stored = localStorage.getItem('theme');
	const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
	let theme = stored || (prefersDark ? 'dark' : 'light');

	function applyTheme(t) {
		if (t === 'dark') root.setAttribute('data-theme', 'dark');
		else root.removeAttribute('data-theme');
	}

	applyTheme(theme);

	// Wire up button
	const btn = document.querySelector('.theme-toggle button');
	if (!btn) return;

	// Reflect initial pressed state for accessibility
	btn.setAttribute('aria-pressed', root.getAttribute('data-theme') === 'dark');

	btn.addEventListener('click', () => {
		const isDark = root.getAttribute('data-theme') === 'dark';
		const next = isDark ? 'light' : 'dark';
		applyTheme(next);
		localStorage.setItem('theme', next);
		btn.setAttribute('aria-pressed', next === 'dark');
	});
});
