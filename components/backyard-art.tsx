import Image from "next/image";
import type { ReactNode } from "react";

// Bandeirinhas de festa penduradas em duas curvas no alto da primeira tela.
const SWAGS = 2;
const FLAGS_PER_SWAG = 11;
const LINE_TOP = 4;
const LINE_SAG = 34;
const flagColors = ["#ffd536", "#4f7ee8", "#ffffff", "#ff8a3d", "#7fd1c3"];

const flags = Array.from({ length: SWAGS * FLAGS_PER_SWAG }, (_, index) => {
  const swag = Math.floor(index / FLAGS_PER_SWAG);
  const t = ((index % FLAGS_PER_SWAG) + 1) / (FLAGS_PER_SWAG + 1);
  return { left: ((swag + t) / SWAGS) * 100, top: LINE_TOP + LINE_SAG * 4 * t * (1 - t), color: flagColors[index % flagColors.length] };
});

const line = Array.from({ length: SWAGS }, (_, swag) => {
  const start = (swag / SWAGS) * 100, end = ((swag + 1) / SWAGS) * 100;
  return `M${start} ${LINE_TOP} Q${(start + end) / 2} ${LINE_TOP + LINE_SAG * 2} ${end} ${LINE_TOP}`;
}).join(" ");

const stars = [[6, 22], [14, 48], [23, 12], [31, 38], [44, 18], [52, 52], [58, 8], [67, 30], [76, 14], [84, 44], [92, 24], [97, 56]];

export function Bunting() {
  return <div className="bunting" aria-hidden="true">
    <svg viewBox="0 0 100 60" preserveAspectRatio="none"><path d={line} /></svg>
    {flags.map((flag, index) => <span key={index} className="flag" style={{ left: `${flag.left}%`, top: `${flag.top}px`, background: flag.color, animationDelay: `${(index % 6) * -0.45}s` }} />)}
  </div>;
}

export function NightSky() {
  return <div className="night-sky" aria-hidden="true">
    <span className="moon" />
    {stars.map(([left, top], index) => <span key={index} className="star" style={{ left: `${left}%`, top: `${top + 70}px`, animationDelay: `${index * 0.37}s` }} />)}
    <span className="cloud cloud-one" />
    <span className="cloud cloud-two" />
  </div>;
}

// Janelas acendem em sequência quando o site abre; a ordem segue o índice de cada uma.
function Win({ x, y, w = 24, h = 30, order, shutter, box, grid, sw = 7 }: { x: number; y: number; w?: number; h?: number; order: number; shutter?: string; box?: boolean; grid?: boolean; sw?: number }) {
  return <g>
    {shutter && <><rect x={x - sw - 2} y={y} width={sw} height={h} fill={shutter} /><rect x={x + w + 2} y={y} width={sw} height={h} fill={shutter} /></>}
    <rect className="win" x={x} y={y} width={w} height={h} style={{ animationDelay: `${0.5 + order * 0.2}s` }} />
    <path d={grid ? `M${x + w / 2} ${y}V${y + h}M${x} ${y + h / 3}H${x + w}M${x} ${y + 2 * h / 3}H${x + w}` : `M${x + w / 2} ${y}V${y + h}M${x} ${y + h / 2}H${x + w}`} stroke="#f6f3ea" strokeWidth="1.8" />
    <rect x={x} y={y} width={w} height={h} fill="none" stroke="#f6f3ea" strokeWidth="2.6" />
    <rect x={x - 3} y={y + h} width={w + 6} height="3" fill="#f6f3ea" />
    {box && <g><rect x={x - 4} y={y + h + 3} width={w + 8} height="7" fill="#6b4426" />{[0, 1, 2, 3].map(i => <circle key={i} cx={x + 2 + i * (w - 4) / 3} cy={y + h + 2} r="3.2" fill={i % 2 ? "#f7e14b" : "#e8435a"} />)}</g>}
  </g>;
}

// Casa em vista de 3/4, como no desenho: lateral esquerda com a ponta do telhado, frente com tábuas e telhado de telhas cinza.
function House({ x, y, w, h, d = 34, roofH, wall, side, line, roof = "#a7a6bf", children }: { x: number; y: number; w: number; h: number; d?: number; roofH: number; wall: string; side: string; line: string; roof?: string; children?: ReactNode }) {
  const ridgeY = y - 4 - roofH;
  const rows = 6;
  return <g>
    <path d={`M${x - d} ${y - 8}L${x} ${y}V${y + h}L${x - d} ${y + h - 8}Z`} fill={side} />
    <path d={`M${x - d - 3} ${y - 6}L${x - d / 2} ${ridgeY}L${x + 2} ${y + 1}Z`} fill={side} stroke="#f6f3ea" strokeWidth="3" strokeLinejoin="round" />
    <rect x={x} y={y} width={w} height={h} fill={wall} />
    {Array.from({ length: Math.floor(h / 8) }, (_, i) => <path key={i} d={`M${x} ${y + 8 * (i + 1)}H${x + w}`} stroke={line} strokeWidth="1.2" />)}
    <path d={`M${x - 2} ${y + 2}L${x - d / 2} ${ridgeY}H${x + w + 6 - d / 2}L${x + w + 8} ${y + 2}Z`} fill={roof} />
    {Array.from({ length: rows - 1 }, (_, i) => { const k = (i + 1) / rows; const yy = y + 2 - k * (roofH + 6); const off = (d / 2 - 2) * k; return <path key={i} d={`M${x - 2 - off} ${yy}H${x + w + 8 - off}`} stroke="rgba(70,68,100,.35)" strokeWidth="1.6" strokeDasharray="10 3" />; })}
    <path d={`M${x - d / 2} ${ridgeY}H${x + w + 6 - d / 2}`} stroke="#8d8ba6" strokeWidth="3" />
    <rect x={x - 3} y={y} width={w + 11} height="4" fill="#f6f3ea" />
    <rect x={x + w - 2} y={y} width="4" height={h} fill="#f6f3ea" /><rect x={x - 2} y={y} width="4" height={h} fill="#f6f3ea" />
    {children}
  </g>;
}

// Janelinha do sótão: o tamanho segue a escala "s" (1 = casa laranja; a casa azul usa uma maior, como no desenho).
function Dormer({ x, y, wall, order, s = 1, roof = "#a7a6bf" }: { x: number; y: number; wall: string; order: number; s?: number; roof?: string }) {
  const w = 34 * s, h = 30 * s, peak = 18 * s;
  return <g>
    <rect x={x} y={y} width={w} height={h} fill={wall} />
    <rect x={x - 2} y={y} width="3" height={h} fill="#f6f3ea" /><rect x={x + w - 1} y={y} width="3" height={h} fill="#f6f3ea" />
    <path d={`M${x - 6 * s} ${y + 2}L${x + w / 2} ${y - peak}L${x + w + 6 * s} ${y + 2}Z`} fill={roof} stroke="#f6f3ea" strokeWidth="3" strokeLinejoin="round" />
    <Win x={x + w * .24} y={y + h * .16} w={w * .52} h={h * .68} order={order} grid={s > 1.2} />
  </g>;
}

function Chimney({ x, y, h, stone }: { x: number; y: number; h: number; stone?: boolean }) {
  return <g>
    <circle className="smoke" cx={x + 11} cy={y - 6} r="7" />
    <circle className="smoke smoke-late" cx={x + 11} cy={y - 6} r="5" />
    <rect x={x} y={y} width="22" height={h} fill={stone ? "#7f7d86" : "#a4523f"} />
    {stone ? [[4, 8], [12, 18], [5, 28], [14, 36]].map(([cx, cy]) => <ellipse key={`${cx}${cy}`} cx={x + cx} cy={y + cy} rx="5" ry="3" fill="#95939c" />) : [8, 16, 24, 32].map(cy => <path key={cy} d={`M${x} ${y + cy}H${x + 22}`} stroke="#86402f" strokeWidth="1.4" />)}
    <rect x={x - 2} y={y} width="26" height="5" fill={stone ? "#6a6870" : "#86402f"} />
  </g>;
}

function Umbrella({ x, y, r, a, b, segments = 8 }: { x: number; y: number; r: number; a: string; b: string; segments?: number }) {
  const point = (t: number) => `${x + r * Math.cos(Math.PI + t * Math.PI)} ${y + r * 0.5 * Math.sin(Math.PI + t * Math.PI)}`;
  const wedge = (from: number, to: number) => `M${x} ${y - r * 0.18}L${point(from)}A${r} ${r * 0.5} 0 0 1 ${point(to)}Z`;
  return <g>
    <rect x={x - 1.5} y={y - 6} width="3" height="66" fill="#ece7da" />
    {Array.from({ length: segments }, (_, i) => <path key={i} d={wedge(i / segments, (i + 1) / segments)} fill={i % 2 ? b : a} />)}
  </g>;
}

function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-6" y="20" width="12" height="70" fill="#4a3628" />
    <circle cx="0" cy="-6" r="44" fill="#1f7a3e" /><circle cx="-34" cy="18" r="32" fill="#1a6a35" /><circle cx="34" cy="16" r="34" fill="#238745" /><circle cx="6" cy="-38" r="30" fill="#2b9550" /><circle cx="-20" cy="-26" r="22" fill="#26904b" />
  </g>;
}

function WoodFence({ x, w, y = 196 }: { x: number; w: number; y?: number }) {
  return <g>{Array.from({ length: Math.ceil(w / 11) }, (_, i) => <rect key={i} x={x + i * 11} y={y} width="10" height={256 - y} fill={i % 2 ? "#8b5c36" : "#7d5230"} />)}</g>;
}

function Chair({ x, color = "#7a4a26" }: { x: number; color?: string }) {
  return <path d={`M${x} 250 V232 H${x + 16} V250 M${x} 240 H${x + 22} M${x + 16} 232 L${x + 20} 218`} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />;
}

// Pedras da parede de baixo da casa azul (posição, tamanho e tom).
const stoneWall: [number, number, number, string][] = [[172, 184, 10, "#9b9aa6"], [194, 184, 11, "#8e8d99"], [218, 184, 8, "#7f7e8a"], [236, 184, 8, "#85848f"], [254, 184, 12, "#8e8d99"], [280, 184, 12, "#9b9aa6"], [306, 184, 8, "#8e8d99"], [324, 184, 11, "#a5a4ae"], [348, 184, 8, "#9b9aa6"], [366, 184, 8, "#7f7e8a"], [384, 184, 11, "#8e8d99"], [408, 184, 12, "#8e8d99"], [434, 184, 9, "#7f7e8a"], [181, 196, 8, "#7f7e8a"], [305, 196, 12, "#9b9aa6"], [331, 196, 10, "#a5a4ae"], [353, 196, 9, "#7f7e8a"], [417, 196, 10, "#7f7e8a"], [439, 196, 13, "#9b9aa6"], [172, 208, 8, "#7f7e8a"], [304, 208, 12, "#8e8d99"], [330, 208, 12, "#8e8d99"], [356, 208, 12, "#9b9aa6"], [406, 208, 13, "#7f7e8a"], [434, 208, 11, "#85848f"], [181, 220, 11, "#7f7e8a"], [293, 220, 9, "#9b9aa6"], [313, 220, 8, "#7f7e8a"], [331, 220, 10, "#7f7e8a"], [353, 220, 11, "#85848f"], [405, 220, 11, "#85848f"], [429, 220, 12, "#8e8d99"], [172, 232, 8, "#7f7e8a"], [300, 232, 11, "#8e8d99"], [324, 232, 13, "#8e8d99"], [352, 232, 12, "#7f7e8a"], [422, 232, 13, "#85848f"], [181, 244, 12, "#a5a4ae"], [293, 244, 10, "#a5a4ae"], [315, 244, 13, "#8e8d99"], [343, 244, 8, "#85848f"], [361, 244, 13, "#7f7e8a"], [417, 244, 11, "#85848f"], [441, 244, 13, "#a5a4ae"]];

function Adirondack({ x }: { x: number }) {
  return <g fill="#8a5530">
    <path d={`M${x + 3} 238 L${x + 1} 214 Q${x + 11} 206 ${x + 21} 214 L${x + 19} 238Z`} />
    <path d={`M${x + 7} 216 V236 M${x + 11} 212 V236 M${x + 15} 216 V236`} stroke="#6e4224" strokeWidth="1.2" />
    <rect x={x - 3} y={234} width={28} height={6} rx={2} />
    <rect x={x - 5} y={226} width={8} height={4} rx={1} /><rect x={x + 19} y={226} width={8} height={4} rx={1} />
    <rect x={x - 2} y={240} width={4} height={12} /><rect x={x + 20} y={240} width={4} height={12} />
  </g>;
}

function PolkaUmbrella({ x, y, r }: { x: number; y: number; r: number }) {
  const scallops = Array.from({ length: 6 }, (_, i) => { const x0 = x - r + (2 * r / 6) * i; return `Q${x0 + r / 6} ${y + 12} ${x0 + r / 3} ${y}`; }).join(" ");
  return <g>
    <rect x={x - 1.5} y={y - 4} width="3" height="56" fill="#ece7da" />
    <path d={`M${x - r} ${y} Q${x - r} ${y - r * .7} ${x} ${y - r * .72} Q${x + r} ${y - r * .7} ${x + r} ${y} ${scallops.replace(/^/, "")}`} fill="#f58bbf" />
    <path d={`M${x - r} ${y} ${scallops}`} fill="#f58bbf" />
    {[[-28, -14, 7], [-6, -24, 6], [18, -18, 7], [34, -6, 5], [-38, -4, 5], [4, -8, 6]].map(([dx, dy, rr], i) => <circle key={i} cx={x + dx} cy={y + dy} r={rr} fill="#e2589c" />)}
  </g>;
}

// Casas da vizinhança: menores, mais baixas no horizonte e com só algumas janelas acesas.
const neighbors = [
  { x: -680, s: .7, h: 130, w: 200, wall: "#7ccfa8", side: "#62b58e", line: "#70c39c", lit: [0, 3] },
  { x: -500, s: .64, h: 84, w: 190, wall: "#9fc6e6", side: "#86aed0", line: "#93badb", lit: [1] },
  { x: 1660, s: .64, h: 84, w: 180, wall: "#f5a66b", side: "#db8c52", line: "#e99a5f", lit: [0, 1] },
  { x: 1830, s: .64, h: 84, w: 190, wall: "#f2b6cf", side: "#d99db7", line: "#e6aac3", lit: [0] },
  { x: 2000, s: .7, h: 130, w: 200, wall: "#b79be0", side: "#9d81c6", line: "#ab8fd4", lit: [0, 3] },
];

function FarHouse({ x, s, h, w, wall, side, line, lit }: { x: number; s: number; h: number; w: number; wall: string; side: string; line: string; lit: number[] }) {
  const twoStory = h > 100;
  const spots = twoStory ? [[30, 20], [w - 60, 20], [30, h - 50], [w - 60, h - 50]] : [[28, 22], [w - 58, 22]];
  return <g transform={`translate(${x} ${250 - h * s}) scale(${s})`}>
    <House x={34} y={0} w={w} h={h} roofH={twoStory ? 50 : 56} wall={wall} side={side} line={line}>
      {spots.map(([wx, wy], i) => lit.includes(i)
        ? <Win key={i} x={34 + wx} y={wy} w={28} h={34} order={14 + i} />
        : <rect key={i} x={34 + wx} y={wy} width="28" height="34" fill="#1d2a55" stroke="#f6f3ea" strokeWidth="2.6" />)}
      <rect x={34 + w / 2 - 14} y={h - 52} width="28" height="52" fill="#e9ecf2" />
    </House>
  </g>;
}

// As três casas do quintal, como no desenho: azul com base de pedra, laranja com varanda e escorregador, rosa com deck e guarda-sol.
export function BackyardHouses() {
  return <svg className="backyard-houses" viewBox="0 0 1440 260" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
    {/* vizinhança ao fundo, como na vista de cima do desenho: casinhas menores e mais escuras nas laterais */}
    <g opacity=".92">
      {neighbors.map(n => <FarHouse key={n.x} {...n} />)}
    </g>
    <WoodFence x={-700} w={770} y={234} /><WoodFence x={1370} w={770} y={234} />
    <rect x="-700" y="252" width="700" height="8" fill="#2f9a45" /><rect x="1440" y="252" width="700" height="8" fill="#2f9a45" />
    <WoodFence x={470} w={90} y={204} /><WoodFence x={880} w={70} y={204} />
    <Tree x={505} y={150} s={1.25} /><Tree x={918} y={150} s={1.2} />

    {/* casa amarela, à esquerda: dois andares, três janelas em cima com venezianas mostarda, porta branca com degraus,
        uma janela embaixo, chaminé de pedra na ponta direita e canteiros de arbustos */}
    <Tree x={-300} y={160} s={1.05} />
    <Chimney x={-62} y={22} h={66} stone />
    <House x={-250} y={120} w={226} h={132} d={44} roofH={66} wall="#f3c843" side="#d6aa2b" line="#e4b937">
      <Win x={-226} y={134} w={30} h={38} order={5} shutter="#d9961c" grid />
      <Win x={-152} y={134} w={30} h={38} order={7} shutter="#d9961c" grid />
      <Win x={-78} y={134} w={30} h={38} order={9} shutter="#d9961c" grid />
      <rect x="-190" y="194" width="32" height="58" fill="#f4f6fa" stroke="#dfe3ec" strokeWidth="1.5" />
      <g><rect className="win" x="-185" y="199" width="22" height="22" style={{ animationDelay: "2.1s" }} /><path d="M-174 199V221M-185 210H-163" stroke="#f4f6fa" strokeWidth="1.6" /></g>
      <circle cx="-164" cy="230" r="2.2" fill="#9aa3b8" />
      <Win x={-96} y={196} w={32} h={38} order={11} shutter="#d9961c" grid />
    </House>
    {[[-192, 246], [-194, 250], [-196, 254]].map(([x, y]) => <rect key={y} x={x} y={y} width="36" height="4" fill="#a9b6cc" stroke="#8f9cb4" strokeWidth=".8" />)}
    {[-140, -126, -112, -98, -84, -70, -56, -42].map((x, i) => <circle key={x} cx={x} cy={248} r="8" fill={i % 2 ? "#2f8f46" : "#3aa152"} />)}
    {[-140, -112, -84, -56].map(x => <circle key={x} cx={x + 4} cy={244} r="2.4" fill="#cfe8ff" />)}
    {[-244, -232, -220, -208].map((x, i) => <circle key={x} cx={x} cy={248} r="8" fill={i % 2 ? "#2f8f46" : "#3aa152"} />)}

    {/* casa roxa, à direita: térrea com telhado alto e escuro, janelinha no telhado à esquerda, porta amarela
        com escada, duas janelas com venezianas vermelhas e chaminé de tijolo. Uma cerca de madeira separa o quintal dela do da casa rosa */}
    <Chimney x={1542} y={62} h={66} />
    <House x={1360} y={178} w={222} h={74} d={40} roofH={96} wall="#a685d8" side="#8668bd" line="#9878cc" roof="#7b7a8c">
      <rect x="1376" y="190" width="30" height="62" fill="#f3dc8a" stroke="#d9c06c" strokeWidth="1.5" />
      <g><rect className="win" x="1381" y="195" width="20" height="20" style={{ animationDelay: "2.3s" }} /><path d="M1391 195V215M1381 205H1401" stroke="#f3dc8a" strokeWidth="1.6" /></g>
      <circle cx="1401" cy="232" r="2.2" fill="#8a7a3c" />
      <Win x={1462} y={196} w={30} h={30} order={12} shutter="#cf2335" grid />
      <Win x={1524} y={196} w={30} h={30} order={13} shutter="#cf2335" grid />
    </House>
    <Dormer x={1392} y={112} wall="#a685d8" order={6} s={1.25} roof="#7b7a8c" />
    {/* cerca de madeira marrom entre o quintal da casa rosa e o da casa roxa: postes com duas travessas na frente da lateral */}
    <g>
      {Array.from({ length: 7 }, (_, i) => <g key={i}><path d={`M${1298 + i * 11} 214 l3 -4 l3 4 V252 h-6Z`} fill="#8b5a32" /></g>)}
      <rect x="1296" y="222" width="76" height="5" fill="#a06a3d" /><rect x="1296" y="238" width="76" height="5" fill="#a06a3d" />
    </g>
    {[[1372, 246], [1370, 250], [1368, 254]].map(([x, y]) => <rect key={y} x={x} y={y} width="38" height="4" fill="#b9c8b4" stroke="#98a893" strokeWidth=".8" />)}
    {[1424, 1438, 1452, 1566, 1580].map((x, i) => <circle key={x} cx={x} cy={248} r="8" fill={i % 2 ? "#2f8f46" : "#3aa152"} />)}
    {[1428, 1570].map(x => <circle key={x} cx={x} cy={244} r="2.4" fill="#ffffff" />)}
    <Tree x={1640} y={158} s={1.05} />

    {/* casa azul do Pablo: andar de cima azul com janelas de seis vidros, andar de baixo de pedra, janelinha na ponta lateral do telhado */}
    <Chimney x={352} y={4} h={60} stone />
    <House x={168} y={112} w={282} h={140} d={58} roofH={86} wall="#4566e0" side="#2f4cbc" line="#3a58cc">
      <path d="M110 166 L168 176 V252 L110 242Z" fill="#6c6b75" />
      {[[120, 186], [146, 196], [124, 216], [150, 226], [132, 236]].map(([cx, cy]) => <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx="10" ry="6" fill="#807f8a" stroke="#5c5b65" strokeWidth="1" />)}
      <rect x="168" y="176" width="282" height="76" fill="#7d7c88" />
      {stoneWall.map(([cx, cy, rx, tone], i) => <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={rx * .55} fill={tone} stroke="#62616c" strokeWidth="1.2" />)}
      <rect x="166" y="174" width="288" height="4" fill="#f6f3ea" />
      <Win x={216} y={124} w={32} h={40} order={0} shutter="#1d2a6e" grid />
      <Win x={340} y={124} w={32} h={40} order={4} shutter="#1d2a6e" grid />
      <g><rect className="win" x="184" y="188" width="100" height="52" style={{ animationDelay: "1.6s" }} /><path d="M217 188V240M251 188V240M184 204H284" stroke="#f6f3ea" strokeWidth="2.4" /><rect x="184" y="188" width="100" height="52" fill="none" stroke="#f6f3ea" strokeWidth="3.2" /><rect x="181" y="240" width="106" height="3" fill="#f6f3ea" /></g>
      <rect x="370" y="194" width="32" height="58" fill="#f4f6fa" stroke="#dfe3ec" strokeWidth="1.5" />
      <g><rect className="win" x="375" y="199" width="22" height="24" style={{ animationDelay: "1.9s" }} /><path d="M382.3 199V223M389.6 199V223M375 211H397" stroke="#f4f6fa" strokeWidth="1.6" /></g>
      <circle cx="398" cy="232" r="2.2" fill="#9aa3b8" />
      <rect x="408" y="200" width="6" height="9" rx="2" fill="#ffe08a" />
      <rect x="446" y="112" width="5" height="140" fill="#f6f3ea" /><path d="M448 250 Q448 256 456 256" fill="none" stroke="#f6f3ea" strokeWidth="5" />
      <g><rect x="334" y="238" width="30" height="10" fill="#7a5132" />{[0, 1, 2, 3].map(i => <circle key={i} cx={338 + i * 7.5} cy={236} r="4" fill={i % 2 ? "#f7e14b" : "#5fbf5a"} />)}</g>
    </House>
    <Dormer x={196} y={50} wall="#4566e0" order={2} s={1.7} />
    <path d="M118 248 H486 L478 258 H124Z" fill="#a8774a" />
    {Array.from({ length: 14 }, (_, i) => <path key={i} d={`M${130 + i * 25} 248 V258`} stroke="#8a5a34" strokeWidth="1.5" />)}
    <Umbrella x={258} y={196} r={50} a="#2c55c9" b="#f4c430" segments={4} />
    <ellipse cx="258" cy="236" rx="24" ry="5" fill="#8f93a3" /><rect x="256" y="236" width="4" height="14" fill="#8f93a3" />
    <Chair x={222} color="#b9bdc8" /><Chair x={278} color="#b9bdc8" />
    <rect x="34" y="240" width="84" height="16" rx="6" fill="#2f9be8" /><rect x="38" y="242" width="76" height="6" rx="3" fill="#7cc8f5" />

    {/* casa laranja: um andar, janelinha laranja no telhado, chaminé à direita, venezianas verde-água com floreiras, varanda com duas cadeiras e escada com corrimão */}
    <Chimney x={796} y={58} h={60} />
    <House x={650} y={166} w={186} h={86} d={40} roofH={74} wall="#f78a2a" side="#d96f1a" line="#e47a20">
      <Win x={672} y={182} w={30} h={36} order={3} shutter="#2fc0c8" grid />
      <Win x={730} y={182} w={30} h={36} order={7} shutter="#2fc0c8" grid />
      <g><rect x="664" y="222" width="46" height="9" fill="#9b6a3c" />{[0, 1, 2, 3, 4].map(i => <circle key={i} cx={668 + i * 9.5} cy={221} r="3.6" fill="#f7d93c" />)}</g>
      <g><rect x="722" y="222" width="46" height="9" fill="#9b6a3c" />{[0, 1, 2, 3, 4].map(i => <circle key={i} cx={726 + i * 9.5} cy={221} r="3.6" fill="#f7d93c" />)}</g>
      <rect x="796" y="196" width="30" height="56" fill="#f4f6fa" stroke="#dfe3ec" strokeWidth="1.5" />
      <g><rect className="win" x="801" y="201" width="20" height="22" style={{ animationDelay: "1.4s" }} /><path d="M807.6 201V223M814.3 201V223M801 212H821" stroke="#f4f6fa" strokeWidth="1.6" /></g>
      <circle cx="820" cy="232" r="2.2" fill="#9aa3b8" />
      <rect x="830" y="202" width="5" height="8" rx="2" fill="#ffe08a" />
    </House>
    <Dormer x={704} y={114} wall="#f78a2a" order={1} />
    <path d="M636 244 H830 L826 256 H640Z" fill="#c8945c" />
    {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${650 + i * 21} 244 V256`} stroke="#a77846" strokeWidth="1.4" />)}
    {[[826, 244], [832, 248], [838, 252]].map(([x, y]) => <rect key={x} x={x} y={y} width="22" height="5" fill="#c8945c" stroke="#a77846" strokeWidth="1" />)}
    <path d="M848 252 V230 L828 214" fill="none" stroke="#a77846" strokeWidth="3" />
    <Adirondack x={688} /><Adirondack x={740} />
    {[642, 654, 666, 678, 690, 702, 714, 726, 738, 750, 762, 774, 786, 798, 810].map((x, i) => <circle key={x} cx={x} cy={256} r="3.8" fill={i % 4 === 2 ? "#cfe8b4" : "#ffffff"} />)}
    <g><rect x="566" y="178" width="8" height="78" fill="#8a5a34" /><rect x="596" y="178" width="8" height="78" fill="#8a5a34" /><rect x="562" y="196" width="46" height="7" fill="#8a5a34" /><path d="M562 180 L585 164 L608 180Z" fill="#8a5a34" />
      <path d="M604 200 Q622 206 628 228 Q634 250 656 254 L650 260 Q626 256 620 232 Q614 212 598 206Z" fill="#f8d22a" /></g>
    <rect x="864" y="244" width="42" height="12" fill="none" stroke="#d1253e" strokeWidth="4" /><rect x="866" y="247" width="38" height="7" fill="#ead39a" />

    {/* casa rosa: chaminé de tijolo à esquerda, três janelas com venezianas vermelhas grandes, porta com degrau e barris de flores, uma janela embaixo e guarda-sol rosa de bolinhas */}
    <Chimney x={1032} y={28} h={50} />
    <House x={1020} y={126} w={270} h={126} d={44} roofH={72} wall="#f6a4c0" side="#df88a7" line="#ea95b3">
      <Win x={1052} y={138} w={34} h={40} order={5} shutter="#d3122d" grid sw={13} />
      <Win x={1138} y={138} w={34} h={40} order={8} shutter="#d3122d" grid sw={13} />
      <Win x={1224} y={138} w={34} h={40} order={10} shutter="#d3122d" grid sw={13} />
      <rect x="1074" y="196" width="40" height="4" fill="#c8c9d2" />
      <rect x="1078" y="200" width="32" height="52" fill="#f4f6fa" stroke="#dfe3ec" strokeWidth="1.5" />
      <g><rect className="win" x="1083" y="205" width="22" height="20" style={{ animationDelay: "1.8s" }} /><path d="M1094 205V225M1083 211.6H1105M1083 218.3H1105" stroke="#f4f6fa" strokeWidth="1.6" /></g>
      <circle cx="1104" cy="236" r="2.2" fill="#9aa3b8" />
      <Win x={1196} y={202} w={34} h={36} order={9} shutter="#d3122d" grid sw={13} />
      <rect x="1285" y="126" width="5" height="126" fill="#c8c9d2" />
    </House>
    <rect x="1070" y="248" width="48" height="5" fill="#b5b6c0" /><rect x="1066" y="253" width="56" height="5" fill="#a5a6b0" />
    {[1056, 1132].map(x => <g key={x}><path d={`M${x - 9} 242 h18 l-2 16 h-14z`} fill="#8a5a34" /><path d={`M${x - 9} 247 h18 M${x - 8} 253 h16`} stroke="#6b4426" strokeWidth="1.2" />{[-6, 0, 6, -3, 3].map((dx, i) => <circle key={i} cx={x + dx} cy={i < 3 ? 239 : 235} r="3.4" fill="#ffffff" />)}</g>)}
    <PolkaUmbrella x={1240} y={200} r={50} />
    <rect x="1186" y="234" width="100" height="7" fill="#6b4426" /><rect x="1196" y="241" width="6" height="16" fill="#6b4426" /><rect x="1270" y="241" width="6" height="16" fill="#6b4426" />
    <rect x="1176" y="246" width="120" height="5" fill="#7a5132" />
    <ellipse cx="1240" cy="254" rx="12" ry="3" fill="#e0569b" />

    {/* gramado do quintal, que é de todo mundo */}
    <rect x="0" y="252" width="1440" height="8" fill="#2f9a45" />
  </svg>;
}

export function BackyardFence() {
  return <div className="backyard" aria-hidden="true">
    <Image className="backyard-pablo" src="/pablo/pablo-acenando.webp" width={503} height={700} sizes="160px" alt="" />
    <svg className="backyard-fence">
      <defs>
        <pattern id="picket" width="34" height="72" patternUnits="userSpaceOnUse">
          <path d="M5 72V17L16 4l11 13v55z" />
        </pattern>
      </defs>
      <rect className="fence-rail" x="0" y="28" width="100%" height="8" />
      <rect className="fence-rail" x="0" y="52" width="100%" height="8" />
      <rect className="fence-pickets" x="0" y="0" width="100%" height="72" fill="url(#picket)" />
    </svg>
    <span className="backyard-grass" />
  </div>;
}

// Pegadas de pinguim que levam até o Pablo, como se ele tivesse ido na frente.
export function PabloTracks() {
  return <div className="pablo-tracks" aria-hidden="true">
    {Array.from({ length: 7 }, (_, index) => <svg key={index} className="track" viewBox="0 0 20 22" style={{ animationDelay: `${index * 0.18}s` }}><path d="M10 21c-3 0-5-2-5-5 0-2 1-4 2-6L3 4c-.6-1 .6-2 1.5-1.3L9 6V1.5C9 .6 11 .6 11 1.5V6l4.5-3.3c.9-.7 2.1.3 1.5 1.3l-4 6c1 2 2 4 2 6 0 3-2 5-5 5z" /></svg>)}
    <Image className="tracks-pablo" src="/pablo/pablo-andando.webp" width={277} height={350} sizes="60px" alt="" />
  </div>;
}

// Rodapé da gincana: céu com estrelas, mar com barquinho de pescador e peixes (referência a São Pedro Pescador).
const footerStars = [[4, 18], [11, 42], [19, 10], [27, 30], [36, 14], [48, 36], [57, 12], [66, 28], [74, 8], [83, 34], [91, 16], [97, 40]];

export function FooterSea() {
  return <div className="footer-sea" aria-hidden="true">
    {footerStars.map(([left, top], index) => <span key={index} className="star" style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${index * 0.41}s` }} />)}
    <svg className="footer-waves" viewBox="0 0 1440 90" preserveAspectRatio="none">
      <path className="wave wave-back" d="M0 40 Q60 26 120 40 T240 40 T360 40 T480 40 T600 40 T720 40 T840 40 T960 40 T1080 40 T1200 40 T1320 40 T1440 40 T1560 40 T1680 40 V90 H0Z" />
      <path className="wave wave-front" d="M0 56 Q60 44 120 56 T240 56 T360 56 T480 56 T600 56 T720 56 T840 56 T960 56 T1080 56 T1200 56 T1320 56 T1440 56 T1560 56 T1680 56 V90 H0Z" />
    </svg>
    <svg className="footer-boat" viewBox="0 0 120 90">
      <path d="M58 8 V60" stroke="#e9efff" strokeWidth="3" />
      <path d="M61 12 L96 54 H61Z" fill="#ffd23f" /><path d="M55 18 L28 54 H55Z" fill="#f2f5ff" />
      <path d="M14 60 H106 L92 80 H28Z" fill="#e8435a" /><path d="M20 66 H100" stroke="#ffffff" strokeWidth="3" />
      <path d="M96 30 Q112 40 110 74" fill="none" stroke="#c9d6f2" strokeWidth="1.5" strokeDasharray="3 3" />
    </svg>
    {[0, 1, 2].map(index => <svg key={index} className={`footer-fish fish-${index}`} viewBox="0 0 40 20"><path d="M4 10 Q16 0 28 10 Q16 20 4 10Z M28 10 L38 3 V17Z" /><circle cx="11" cy="9" r="1.6" fill="#071b50" /></svg>)}
  </div>;
}
