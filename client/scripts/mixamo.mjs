import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';

// Converts the Mixamo FBX sources in ../assets_src/mixamo into compressed, LOD'd glTF under public/assets/characters.
const SRC = resolve('../assets_src/mixamo'), OUT = resolve('public/assets/characters');
const CHARACTERS = { pnp: 'Swat.fbx', fls: 'T-Pose.5.fbx', civ_a: 'T-Pose.2.fbx', civ_b: 'T-Pose.3.fbx', civ_c: 'T-Pose.4.fbx' };
const P = (f) => `pack/${f}.fbx`;
const ANIMS = [
  ['idle', P('idle'), 1], ['aim', P('idle aiming'), 1],
  ['walk_f', P('walk forward'), 1], ['walk_b', P('walk backward'), 1], ['walk_l', P('walk left'), 1], ['walk_r', P('walk right'), 1],
  ['walk_fl', P('walk forward left'), 1], ['walk_fr', P('walk forward right'), 1], ['walk_bl', P('walk backward left'), 1], ['walk_br', P('walk backward right'), 1],
  ['run_f', P('run forward'), 1], ['run_b', P('run backward'), 1], ['run_l', P('run left'), 1], ['run_r', P('run right'), 1],
  ['run_fl', P('run forward left'), 1], ['run_fr', P('run forward right'), 1], ['run_bl', P('run backward left'), 1], ['run_br', P('run backward right'), 1],
  ['sprint', P('sprint forward'), 1],
  ['crouch_idle', P('idle crouching'), 1], ['crouch_aim', P('idle crouching aiming'), 1],
  ['crouch_f', P('walk crouching forward'), 1], ['crouch_b', P('walk crouching backward'), 1], ['crouch_l', P('walk crouching left'), 1], ['crouch_r', P('walk crouching right'), 1],
  ['jump', P('jump loop'), 1], ['jump_up', P('jump up'), 1], ['jump_down', P('jump down'), 1],
  ['climb', 'Climbing.fbx', 2], ['climb_low', 'Climbing.1.fbx', 2], ['ladder', 'Climbing.Ladder.fbx', 2],
  ['hang_climb', 'Freehang.Climb.fbx', 2], ['wall_climb', 'Sprint.To.Wall.Climb.fbx', 2],
  ['vault', 'Jumping.fbx', 2], ['melee', 'Rifle.Punch.fbx', 1],
  ['fire', 'Firing.Rifle.fbx', 1], ['reload', 'Reloading.fbx', 1], ['hit', 'Hit.Reaction.fbx', 1], ['throw', 'Grenade.Throw.fbx', 1],
  ['knock', 'Knocked.Down.fbx', 1], ['getup', 'Getting.Up.fbx', 1],
  ['death_front', P('death from the front'), 0], ['death_back', P('death from the back'), 0], ['death_right', P('death from right'), 0],
  ['death_head', P('death from front headshot'), 0], ['death_crouch', P('death crouching headshot front'), 0], ['dying', 'Dying.fbx', 0], ['fall_back', 'Falling.Back.Death.fbx', 0],
  ['civ_walk', 'Walking.fbx', 1], ['civ_back', 'Walking.Backwards.fbx', 1], ['civ_run', 'Running.fbx', 1], ['terrified', 'Terrified.fbx', 1, 6],
].map(([key, file, inPlace, maxDur]) => ({ key, url: `/src-assets/${file}`, inPlace, maxDur }));

/** Some Mixamo exports carry a long footer that three's FBXLoader mistakes for nodes: cut right after the top-level null record. */
function trimFbx(buf) {
  if (buf.toString('latin1', 0, 18) !== 'Kaydara FBX Binary') return buf;
  const big = buf.readUInt32LE(23) >= 7500, head = big ? 25 : 13;
  let pos = 27;
  while (pos + head <= buf.length) {
    const end = big ? Number(buf.readBigUInt64LE(pos)) : buf.readUInt32LE(pos);
    if (end === 0) return buf.subarray(0, pos + head);
    pos = end;
  }
  return buf;
}

mkdirSync(OUT, { recursive: true });
const server = spawn('npx', ['vite', '--port', '4176', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 4000));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pack = (input, output, args) => execFileSync('npx', ['gltfpack', '-i', input, '-o', output, ...args], { stdio: 'pipe' });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.route('**/src-assets/**', (route) => {
    const file = join(SRC, decodeURIComponent(new URL(route.request().url()).pathname.replace('/src-assets/', '')));
    route.fulfill({ status: 200, body: trimFbx(readFileSync(file)), contentType: 'application/octet-stream' });
  });
  await page.goto('http://localhost:4176/tools/convert.html');
  await page.waitForFunction(() => window.ready, null, { timeout: 60000 });
  const only = process.argv[2];
  for (const [key, file] of Object.entries(CHARACTERS)) {
    if (only && only !== key && only !== 'chars') continue;
    const { data, info } = await page.evaluate(([u]) => window.character(u, 1024, 512), [`/src-assets/${file}`]);
    const lod = await page.evaluate(([u]) => window.character(u, 0, 0), [`/src-assets/${file}`]);
    const raw = join(OUT, `${key}.raw.glb`), rawLod = join(OUT, `${key}.rawlod.glb`);
    writeFileSync(raw, Buffer.from(data, 'base64'));
    writeFileSync(rawLod, Buffer.from(lod.data, 'base64'));
    pack(raw, join(OUT, `${key}.glb`), ['-si', '0.4', '-cc', '-kn', '-km', '-vtf']);
    pack(rawLod, join(OUT, `${key}.lod.glb`), ['-si', '0.08', '-cc', '-kn', '-km', '-kv', '-vtf']);
    execFileSync('rm', [raw, rawLod]);
    console.log(key, info.replace(/\n/g, ' | '), `${(statSync(join(OUT, `${key}.glb`)).size / 1e6).toFixed(2)}MB / lod ${(statSync(join(OUT, `${key}.lod.glb`)).size / 1e6).toFixed(2)}MB`);
  }
  if (!only || only === 'anims') {
    const { data, info } = await page.evaluate(([s, l]) => window.animations(s, l), ['/src-assets/Swat.fbx', ANIMS]);
    const raw = join(OUT, 'anims.raw.glb');
    writeFileSync(raw, Buffer.from(data, 'base64'));
    pack(raw, join(OUT, 'anims.glb'), ['-cc', '-af', '30', '-kn']);
    execFileSync('rm', [raw]);
    console.log(info, `\nanims ${(statSync(join(OUT, 'anims.glb')).size / 1e6).toFixed(2)}MB`);
  }
} finally {
  await browser.close();
  server.kill();
}
