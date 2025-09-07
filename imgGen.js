// Procedural whimsical 'AI-style' SVG header
function whimsicalSVG(seed, theme='river', w=1200, h=220){
  function hash(s){let h=0;for(let i=0;i<s.length;i++){h=(h<<5)-h+s.charCodeAt(i);h|=0;}return Math.abs(h);}
  const rnd=(n)=> (hash(seed+n)%1000)/1000;
  const hue = Math.floor(rnd('h')*360);
  const h2 = (hue+60)%360;
  const gradId = 'g'+hash(seed+'g');
  const waves = Array.from({length:6}).map((_,i)=>{
    const amp = 10+ rnd('a'+i)*30;
    const y = h*0.4 + i*20;
    let d = `M 0 ${y}`;
    for(let x=0;x<=w;x+=40){
      const y2 = y + Math.sin((x+i*90)/50)*(amp);
      d += ` L ${x} ${y2}`;
    }
    return `<path d="${d}" fill="none" stroke="hsla(${(hue+i*12)%360},70%,65%,${0.18})" stroke-width="${2+i/2}" />`;
  }).join('');
  const stars = Array.from({length:30}).map((_,i)=>{
    const x = Math.floor(rnd('x'+i)*w);
    const y = Math.floor(rnd('y'+i)*(h*0.35));
    return `<circle cx="${x}" cy="${y}" r="${1+ (rnd('r'+i)*2)}" fill="hsla(${h2},80%,90%,.6)" />`;
  }).join('');
  const icon = theme==='coffee'
    ? `<g transform="translate(${w-160},${h-90}) scale(1.2)">
         <rect x="-30" y="-20" rx="8" ry="8" width="60" height="40" fill="hsla(${h2},50%,90%,.9)" stroke="hsla(${h2},50%,70%,1)" />
         <path d="M -20 -15 h 40 v 20 a 10 10 0 1 1 -20 0 v -20" fill="white" stroke="#94a3b8"/>
         <circle cx="30" cy="-5" r="10" fill="none" stroke="#64748b" />
       </g>`
    : theme==='campfire'
    ? `<g transform="translate(${w-160},${h-80})">
         <path d="M 0 0 l 20 10 l -40 0 z" fill="#b45309"/>
         <path d="M -5 -5 q 5 -40 20 0 q -5 -20 -15 0" fill="#f59e0b" stroke="#ea580c"/>
       </g>`
    : theme==='trail'
    ? `<g transform="translate(${w-180},${h-80})">
         <path d="M -80 20 q 60 -40 160 0" fill="none" stroke="#94a3b8" stroke-width="8" stroke-linecap="round"/>
         <circle cx="0" cy="0" r="12" fill="#a7f3d0" stroke="#10b981"/>
       </g>`
    : '';
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}">
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="hsl(${hue},70%,92%)"/>
        <stop offset="1" stop-color="hsl(${h2},70%,96%)"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#${gradId})"/>
    ${stars}
    ${waves}
    ${icon}
  </svg>`;
}
