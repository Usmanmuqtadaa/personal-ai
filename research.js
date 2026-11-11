export async function lookupResearch(topic) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  try {
    const res = await fetch(`/api/research?q=${encodeURIComponent(topic.trim().slice(0, 220))}`, { signal: controller.signal });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Research lookup failed');
    return data;
  } finally { clearTimeout(timer); }
}
