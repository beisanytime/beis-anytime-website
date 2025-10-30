export async function render() {
  // Fetch the original HTML as a fallback source and extract <main>
  try {
    const res = await fetch('/recent.html', {cache: 'no-store'});
    if (!res.ok) throw new Error('Failed to fetch recent.html');
    const text = await res.text();
    const m = text.match(/<main[\s\S]*?>[\s\S]*<\/main>/i);
    if (m) return m[0];
    const b = text.match(/<body[\s\S]*?>[\s\S]*<\/body>/i);
    if (b) return b[0];
    return text;
  } catch (e) {
    return `<main><p class="error-message">Could not load page module: ${e.message}</p></main>`;
  }
}
