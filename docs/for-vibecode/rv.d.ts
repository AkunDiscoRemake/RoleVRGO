// Tipos da API JavaScript dos mods do RoleVRGO Studio (window.rv).
interface RvVec { x: number; y: number; z: number }
interface RvPartProps { Position?: RvVec; Size?: RvVec; Orientation?: RvVec; Color?: [number, number, number]; Transparency?: number; Anchored?: boolean; CanCollide?: boolean; Shape?: 'Block' | 'Ball' | 'Cylinder'; Velocity?: RvVec }
interface RvPart { id: string; set<K extends keyof RvPartProps>(key: K, value: RvPartProps[K]): void; destroy(): void }
interface RvApi {
  /** Posição do seu gato, atualizada a cada quadro. */
  player: RvVec;
  on(event: 'tick', fn: (dt: number) => void): void;
  on(event: 'key', fn: (code: string, down: boolean) => void): void;
  on(event: 'chat', fn: (text: string) => void): void;
  on(event: 'touch', fn: (partId: string, entered: boolean) => void): void;
  part(props?: RvPartProps): RvPart;
  toast(text: string, cssColor?: string): void;
  banner(text: string, seconds?: number): void;
  /** No máximo 1 mensagem a cada 5 s. */
  say(text: string): void;
  sound(name: string, volume?: number): void;
  effect(x: number, y: number, z: number, color0xRRGGBB?: number, amount?: number): void;
  teleport(x: number, y: number, z: number): void;
  walkSpeed(v: number): void; jumpPower(v: number): void; gravity(v: number): void; clockTime(hours: number): void; fly(on: boolean): void;
  model(key: string, x: number, y: number, z: number, scale?: number, yaw?: number): { destroy(): void };
  npc(name: string, x: number, y: number, z: number, lines?: string[]): void;
  /** true: o mod recebe cliques (e bloqueia o jogo embaixo). */
  interactive(on: boolean): void;
}
declare const rv: RvApi;
interface Window { rv: RvApi }
