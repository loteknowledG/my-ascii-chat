const readline = require('readline');
const { transmit } = require('../shared/uplink');
const { getMoments, addMoment, searchMemories, getRecentMemories, getStats } = require('../shared/memory');
const { getConfig, setConfig, getAPIConfig } = require('../shared/config');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'mother> ',
});

let currentChannel = 'agenda';
let isProcessing = false;
let streamBuffer = '';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function printBanner() {
  console.log(`
${colors.cyan}${colors.bold}
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ███████╗███╗   ███╗ █████╗ ███████╗████████╗███████╗   ║
║   ██╔════╝████╗ ████║██╔══██╗██╔════╝══██╔══╝██╔════╝   ║
║   █████╗  ██╔████╔██║███████║███████╗   ██║   █████╗     ║
║   ██╔══╝  ██║╚██╔╝██║██╔══██║╚════██║   ██║   ██╔══╝     ║
║   ███████╗██║ ╚═╝ ██║██║  ██║███████║   ██║   ███████╗   ║
║   ╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝   ║
║                                                           ║
║              MOTHER v1.0 - Echo Mirage Cyberdeck          ║
║              Type /help for commands                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);
}

function printHelp() {
  console.log(`
${colors.bold}Commands:${colors.reset}
  /help              Show this help
  /channel <name>    Switch channel (agenda, intel, logs, samus-manus)
  /channels          List all channels
  /memory <query>    Search memories
  /memories          Show recent memories
  /stats             Show database stats
  /config [key] [val] View or set config
  /clear             Clear current channel messages
  /export            Export all data to JSON
  /quit              Exit Mother

${colors.bold}Chat:${colors.reset}
  Just type your message and press Enter
  Mother will respond with streaming text
`);
}

function printMoment(m) {
  const roleColor = m.role === 'AI' ? colors.green : m.role === 'SYS' ? colors.yellow : colors.gray;
  const timestamp = new Date(m.timestamp).toLocaleTimeString();
  console.log(`${colors.dim}[${timestamp}]${colors.reset} ${roleColor}${m.role}${colors.reset}: ${m.text}`);
}

async function handleCommand(input) {
  const parts = input.trim().split(' ');
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);
  
  switch (cmd) {
    case '/help':
      printHelp();
      break;
      
    case '/channel':
      if (args[0]) {
        currentChannel = args[0];
        console.log(`${colors.cyan}Switched to channel: ${currentChannel}${colors.reset}`);
      } else {
        console.log(`${colors.yellow}Usage: /channel <name>${colors.reset}`);
      }
      break;
      
    case '/channels':
      const channels = ['agenda', 'intel', 'logs', 'samus-manus'];
      console.log(`${colors.bold}Available channels:${colors.reset}`);
      for (const ch of channels) {
        const marker = ch === currentChannel ? `${colors.green}▶${colors.reset}` : ' ';
        console.log(`  ${marker} ${ch}`);
      }
      break;
      
    case '/memory':
      if (args.length > 0) {
        const query = args.join(' ');
        console.log(`${colors.cyan}Searching memories for: "${query}"${colors.reset}`);
        const results = searchMemories(query, null, 10);
        if (results.length === 0) {
          console.log(`${colors.gray}No memories found.${colors.reset}`);
        } else {
          for (const mem of results) {
            console.log(`  ${colors.yellow}[${mem.category}]${colors.reset} ${mem.content.slice(0, 100)}...`);
          }
        }
      } else {
        console.log(`${colors.yellow}Usage: /memory <query>${colors.reset}`);
      }
      break;
      
    case '/memories':
      const recent = getRecentMemories(10);
      console.log(`${colors.bold}Recent memories:${colors.reset}`);
      if (recent.length === 0) {
        console.log(`${colors.gray}No memories yet.${colors.reset}`);
      } else {
        for (const mem of recent) {
          console.log(`  ${colors.yellow}[${mem.category}]${colors.reset} ${mem.content.slice(0, 80)}...`);
        }
      }
      break;
      
    case '/stats':
      const stats = getStats();
      console.log(`${colors.bold}Database stats:${colors.reset}`);
      console.log(`  Moments: ${stats.moments}`);
      console.log(`  Memories: ${stats.memories}`);
      console.log(`  Channels: ${stats.channels}`);
      console.log(`  Context keys: ${stats.context_keys}`);
      break;
      
    case '/config':
      if (args.length === 0) {
        const config = getConfig();
        console.log(`${colors.bold}Current config:${colors.reset}`);
        console.log(JSON.stringify(config, null, 2));
      } else if (args.length === 1) {
        const val = getConfig(args[0]);
        console.log(`${args[0]} = ${JSON.stringify(val)}`);
      } else {
        const key = args[0];
        const val = args.slice(1).join(' ');
        setConfig(key, val);
        console.log(`${colors.green}Set ${key} = ${val}${colors.reset}`);
      }
      break;
      
    case '/clear':
      const { clearMoments } = require('../shared/memory');
      const cleared = clearMoments(currentChannel);
      console.log(`${colors.green}Cleared ${cleared} moments from ${currentChannel}${colors.reset}`);
      break;
      
    case '/export':
      const { exportMemory } = require('../shared/memory');
      const data = exportMemory();
      console.log(JSON.stringify(data, null, 2));
      break;
      
    case '/quit':
    case '/exit':
      console.log(`${colors.cyan}Mother shutting down...${colors.reset}`);
      rl.close();
      process.exit(0);
      break;
      
    default:
      console.log(`${colors.red}Unknown command: ${cmd}${colors.reset}`);
      console.log(`${colors.gray}Type /help for available commands${colors.reset}`);
  }
}

async function handleChat(message) {
  if (isProcessing) {
    console.log(`${colors.yellow}Mother is still thinking... please wait.${colors.reset}`);
    return;
  }
  
  isProcessing = true;
  streamBuffer = '';
  
  // Show thinking indicator
  process.stdout.write(`${colors.green}MOTHER${colors.reset}: `);
  
  try {
    await transmit(currentChannel, message, (chunk, full) => {
      streamBuffer = full;
      process.stdout.write(chunk);
    });
    
    console.log(''); // New line after streaming
  } catch (err) {
    console.log(`\n${colors.red}Error: ${err.message}${colors.reset}`);
  } finally {
    isProcessing = false;
  }
}

// Start
printBanner();

// Load recent messages
const recentMessages = getMoments(currentChannel, 5);
if (recentMessages.length > 0) {
  console.log(`${colors.dim}--- Recent messages in ${currentChannel} ---${colors.reset}`);
  for (const m of recentMessages) {
    printMoment(m);
  }
  console.log(`${colors.dim}----------------------------------------${colors.reset}`);
}

rl.prompt();

rl.on('line', async (line) => {
  const input = line.trim();
  
  if (!input) {
    rl.prompt();
    return;
  }
  
  if (input.startsWith('/')) {
    await handleCommand(input);
  } else {
    await handleChat(input);
  }
  
  rl.prompt();
});

rl.on('close', () => {
  console.log(`\n${colors.cyan}Mother offline.${colors.reset}`);
  process.exit(0);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log(`\n${colors.cyan}Mother shutting down...${colors.reset}`);
  rl.close();
  process.exit(0);
});
