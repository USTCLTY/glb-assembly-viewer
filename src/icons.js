const paths={
cube:'<path d="m12 3 9 5v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v8M7 5.8l9 5"/>',
file:'<path d="M14 2H5v20h14V7zM14 2v6h5M8 12h8M8 16h5"/>',
folder:'<path d="M3 7V4h6l3 3h9v4M3 7v13h16l3-9H6l-3 9"/>',
help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.5 1.5c-1 .7-2 1-2 3M12 17h.01"/>',
cursor:'<path d="m5 3 14 10-7 1-4 7z"/>',rotate:'<path d="M20 8a9 9 0 1 0 0 8M20 3v5h-5"/><path d="m8 9 4-2 4 2v6l-4 2-4-2zM8 9l4 2 4-2M12 11v6"/>',
pan:'<path d="M12 2v20M2 12h20M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"/>',
fit:'<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M8 8h8v8H8z"/>',
perspective:'<path d="m3 7 13-4 5 4v13l-5 1L3 18zM3 7l13 3 5-3M16 10v11M7 6v13M11 5v15"/>',
shaded:'<path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9"/><path d="M12 13v9l9-5V8z" fill="currentColor" opacity=".15"/>',
section:'<path d="m3 8 9-5 9 5v9l-9 5-9-5zM3 8l9 5 9-5M12 13v9M2 14l20-5M2 17l20-5"/>',
explode:'<path d="m12 2 8 4-8 4-8-4zM4 11l8 4 8-4M4 16l8 4 8-4M12 10v5M12 20v2"/>',
ruler:'<path d="m3 17 14-14 4 4L7 21zM7 13l2 2M10 10l3 3M13 7l2 2"/>',camera:'<path d="M3 7h5l2-3h4l2 3h5v13H3z"/><circle cx="12" cy="13" r="4"/>',
reset:'<path d="M3 10a9 9 0 1 1 1 7M3 4v6h6"/>',list:'<path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1"/>',
search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
eyeoff:'<path d="M3 3l18 18M10 5c7-1 12 7 12 7l-3 4M6 6c-3 2-4 6-4 6s4 7 10 7c2 0 4-1 5-2M10 10a3 3 0 0 0 4 4"/>',
isolate:'<path d="M7 2H2v5M17 2h5v5M2 17v5h5M22 17v5h-5M12 7l5 3v5l-5 3-5-3v-5zM7 10l5 3 5-3M12 13v5"/>',
grid:'<path d="m2 16 7-12h6l7 12-10 5zM5 11h14M8 6l4 15 4-15M2 16h20"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
expand:'<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',home:'<path d="m3 10 9-8 9 8M5 8v13h5v-7h4v7h5V8"/>',
mouse:'<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v7M6 9h12M12 5v1"/>',
part:'<path d="m12 4 8 4v9l-8 4-8-4V8zM4 8l8 4 8-4M12 12v9"/>',assembly:'<path d="m12 2 5 3-5 3-5-3zM7 5v5l5 3 5-3V5M7 12l5 3v6l-5-3-5 3v-6zM12 15l5-3 5 3v6l-5-3-5 3"/>'};
export function icon(name){return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]||paths.cube}</svg>`;}
export function fillIcons(root=document){root.querySelectorAll('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon));}
