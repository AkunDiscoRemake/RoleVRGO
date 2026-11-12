// Configuração pública do RoleVRGO. A chave abaixo é a chave "publishable"
// do Supabase (feita para ficar no cliente); o banco só é acessado por RPCs.
export const SUPABASE_URL = 'https://kxihxpuaywjfczihmlef.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_teK6wqcKvFojjPBZGh1-vA_t2nTUgX1';
export const VERSION = '1.0.0';

export const EYE = 1.0;          // altura dos olhos do gato (m)
export const REACH = 0.95;       // alcance das patas flutuantes (m)
export const HAND_R = 0.09;      // raio da bolinha-mão
export const BODY_R = 0.28;      // raio de colisão do corpo
export const GRAVITY = 9.2;
export const WALK_SPEED = 3.2;
export const MAX_SPEED = 8.5;
export const DAY_LENGTH = 20 * 60; // segundos por ciclo dia/noite (sincronizado pelo relógio UTC)
