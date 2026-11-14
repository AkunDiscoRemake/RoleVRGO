// Mod de exemplo: cronômetro + posição do gato, e a tecla F faz festa.
// (O mod é "só visual": não recebe cliques nem mouse. Para menus clicáveis, use rv.interactive(true) enquanto o menu estiver aberto.)
let t = 0;
rv.on('tick', (dt) => {
  t += dt;
  document.getElementById('t').textContent = t.toFixed(1).replace('.', ',');
  document.getElementById('pos').textContent = rv.player.x.toFixed(0) + ', ' + rv.player.z.toFixed(0);
});
rv.on('key', (code, down) => {
  if (code !== 'KeyF' || !down) return;
  rv.effect(rv.player.x, rv.player.y + 2, rv.player.z, 0xff60c0, 60);
  rv.sound('win');
  rv.toast('🎉 Festa!');
});
