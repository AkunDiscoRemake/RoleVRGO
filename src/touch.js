// Controles de toque para jogar no celular SEM óculos (VR Box/Cardboard):
// joystick à esquerda, arrastar o resto da tela para olhar, toque rápido = usar/clicar
// e botões de pular, pata, bloquear, correr, câmera e menu.
import { emit } from './util.js';

const CSS = `
#tc{position:fixed;inset:0;pointer-events:none;z-index:20;user-select:none;-webkit-user-select:none;touch-action:none;font-family:sans-serif}
#tc .stick{position:absolute;left:max(18px,env(safe-area-inset-left));bottom:max(22px,env(safe-area-inset-bottom));width:150px;height:150px;border-radius:50%;background:rgba(20,18,40,.28);border:2px solid rgba(255,255,255,.35);pointer-events:auto}
#tc .knob{position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;background:rgba(255,255,255,.55);box-shadow:0 2px 8px rgba(0,0,0,.35)}
#tc .run .knob{background:rgba(255,215,106,.85)}
#tc .b{position:absolute;box-sizing:border-box;overflow:hidden;line-height:1;width:64px;height:64px;border-radius:50%;background:rgba(20,18,40,.42);border:2px solid rgba(255,255,255,.4);color:#fff;font-size:26px;display:flex;align-items:center;justify-content:center;pointer-events:auto}
#tc .b.s{width:48px;height:48px;font-size:20px}
#tc .b.on{background:rgba(255,215,106,.55)}
#tc .b.big{width:84px!important;height:84px!important;font-size:34px}
`;
export const touch = {
  on: false, el: null, P: null,
  want() { return typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0) && matchMedia('(pointer: coarse)').matches; },
  init(player, canvas) {
    if (this.el || !this.want()) return; this.P = player; const P = player;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const el = this.el = document.createElement('div'); el.id = 'tc'; document.body.appendChild(el);
    // joystick
    const stick = document.createElement('div'); stick.className = 'stick'; const knob = document.createElement('div'); knob.className = 'knob'; stick.appendChild(knob); el.appendChild(stick);
    let sid = null, cx = 0, cy = 0; const R = 60;
    const move = (t) => { let dx = t.clientX - cx, dy = t.clientY - cy; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; } knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; P.touchMove.x = dx / R; P.touchMove.y = dy / R; const run = d > R * 1.15; P.keys.ShiftLeft = run; stick.classList.toggle('run', run); };
    stick.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.changedTouches[0]; sid = t.identifier; const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; move(t); }, { passive: false });
    stick.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === sid) move(t); }, { passive: false });
    const endStick = (e) => { for (const t of e.changedTouches) if (t.identifier === sid) { sid = null; knob.style.transform = ''; P.touchMove.x = P.touchMove.y = 0; P.keys.ShiftLeft = false; stick.classList.remove('run'); } };
    stick.addEventListener('touchend', endStick); stick.addEventListener('touchcancel', endStick);
    // botões
    const btn = (txt, css, cls, down, up) => { const b = document.createElement('div'); b.className = 'b ' + (cls || ''); b.textContent = txt; b.style.cssText = css; el.appendChild(b);
      b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); b.classList.add('on'); down && down(); }, { passive: false });
      const u = (e) => { e.preventDefault(); b.classList.remove('on'); up && up(); }; b.addEventListener('touchend', u, { passive: false }); b.addEventListener('touchcancel', u, { passive: false }); return b; };
    const RB = 'right:max(18px,env(safe-area-inset-right));';
    btn('⤒', RB + 'bottom:max(24px,env(safe-area-inset-bottom));', 'big', () => P.jumpPress());
    btn('🐾', RB.replace('18px', '114px') + 'bottom:max(24px,env(safe-area-inset-bottom));', '', () => P._press(), () => P._release());
    btn('🛡', RB.replace('18px', '28px') + 'bottom:max(120px,env(safe-area-inset-bottom));', '', () => { P.guardHold = true; }, () => { P.guardHold = false; });
    btn('↺', RB.replace('18px', '122px') + 'bottom:max(104px,env(safe-area-inset-bottom));', 's', () => P.dodge(-1));
    btn('☰', RB + 'top:max(14px,env(safe-area-inset-top));', 's', () => P.onBack && P.onBack());
    btn('📖', RB.replace('18px', '74px') + 'top:max(14px,env(safe-area-inset-top));', 's', () => P.onMenu && P.onMenu());
    btn('🎥', RB.replace('18px', '130px') + 'top:max(14px,env(safe-area-inset-top));', 's', () => P.cycleView());
    btn('💬', RB.replace('18px', '186px') + 'top:max(14px,env(safe-area-inset-top));', 's', () => emit('openChat'));
    // arrastar a tela olha em volta; toque curto sem arrastar = clicar/usar (mira no centro)
    const looks = new Map();
    canvas.addEventListener('touchstart', (e) => { if (!this.on) return; e.preventDefault(); e.stopImmediatePropagation(); for (const t of e.changedTouches) looks.set(t.identifier, { x: t.clientX, y: t.clientY, t0: performance.now(), d: 0 }); }, { passive: false, capture: true });
    canvas.addEventListener('touchmove', (e) => { if (!this.on) return; e.preventDefault(); e.stopImmediatePropagation(); for (const t of e.changedTouches) { const L = looks.get(t.identifier); if (!L) continue; const dx = t.clientX - L.x, dy = t.clientY - L.y; L.d += Math.abs(dx) + Math.abs(dy); P.yaw -= dx * 0.0065; P.pitch = Math.max(-1.5, Math.min(1.5, P.pitch - dy * 0.0055)); L.x = t.clientX; L.y = t.clientY; } }, { passive: false, capture: true });
    const endLook = (e) => { if (!this.on) return; e.preventDefault(); e.stopImmediatePropagation(); for (const t of e.changedTouches) { const L = looks.get(t.identifier); looks.delete(t.identifier); if (L && L.d < 14 && performance.now() - L.t0 < 300) { P._press(); setTimeout(() => P._release(), 90); } } };
    canvas.addEventListener('touchend', endLook, { passive: false, capture: true }); canvas.addEventListener('touchcancel', endLook, { passive: false, capture: true });
    this.show(true);
  },
  show(v) { this.on = !!v && !!this.el; if (this.el) this.el.style.display = this.on ? 'block' : 'none'; if (!this.on && this.P) { this.P.touchMove.x = this.P.touchMove.y = 0; this.P.keys.ShiftLeft = false; } }
};
