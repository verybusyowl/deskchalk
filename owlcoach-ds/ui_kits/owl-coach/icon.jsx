/* Lucide icon wrapper. Renders <i data-lucide="name">; a screen-level
   effect calls lucide.createIcons() to swap in SVGs. Size via font-size +
   a global rule (svg { width:1em; height:1em }). */
function Icon({ name, size = 18, color = 'currentColor', strokeWidth = 2, style = {} }) {
  return (
    <span
      className="owl-ico"
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size, width: size, height: size, color, ...style }}
    >
      <i data-lucide={name} style={{ ['--sw']: strokeWidth }}></i>
    </span>
  );
}

/* Hook: refresh lucide SVGs after render. */
function useIcons(deps) {
  React.useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  });
}

Object.assign(window, { Icon, useIcons });
