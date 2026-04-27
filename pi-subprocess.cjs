const { spawn } = require('child_process');

let piProc = null;

console.log('[PI_SUB] Module loaded, searching for pi...');
const { execSync } = require('child_process');
try {
  const piPath = execSync('where pi', { encoding: 'utf8', shell: true });
  console.log('[PI_SUB] Found pi at:', piPath);
} catch (e) {
  console.log('[PI_SUB] pi not found in PATH');
}

function setup(onOutput) {
  console.log('[PI_SUB] setup() CALLED');
  if (piProc) {
    piProc.kill();
    piProc = null;
  }

  const args = ['--mode', 'rpc', '--no-session'];
  console.log('[PI_SUB] Spawning pi with args:', args);
  console.log('[PI_SUB] Environment OPENCODE_API_KEY:', process.env.OPENCODE_API_KEY ? 'set' : 'not set');

  piProc = spawn('cmd.exe', ['/c', 'pi', '--mode', 'rpc', '--no-session'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
    env: { ...process.env }
  });

  console.log('[PI_SUB] Process spawned, pid:', piProc ? piProc.pid : 'null');

  if (piProc) {
    console.log('[PI_SUB] Process exists, setting up handlers');
    piProc.stdout.on('data', (data) => {
      const str = data.toString();
      console.log('[PI_SUB] stdout:', str);
      const lines = str.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          onOutput(parsed);
        } catch {
          onOutput({ type: 'stdout', text: line });
        }
      }
    });

    piProc.stderr.on('data', (data) => {
      console.log('[PI_SUB] stderr:', data.toString());
      onOutput({ type: 'stderr', text: data.toString() });
    });

    piProc.on('error', (err) => {
      onOutput({ type: 'error', text: err.message });
    });

    piProc.on('exit', (code) => {
      onOutput({ type: 'exit', code });
      piProc = null;
    });
  }
}

function send(data) {
  if (!piProc || !piProc.stdin) {
    return { success: false, error: 'PI not running' };
  }
  try {
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    piProc.stdin.write(msg + '\n');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function abort() {
  if (piProc) {
    piProc.kill();
    piProc = null;
    return { success: true };
  }
  return { success: false, error: 'PI not running' };
}

function isRunning() {
  return piProc !== null;
}

module.exports = { setup, send, abort, isRunning };