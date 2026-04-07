// src/TerminalArt.js

export const art = {
  // Classic 3D tab art with the Latin glyph centered inside the button.
  popped: (symbol) => `┌───┐\n│ ${symbol} │▓\n└───┘▓\n▓▓▓▓▓`,
  pushed: (symbol) => `\n┌───┐\n│ ${symbol} │\n└───┘`
};

// The main boot screen logo
export const BOOT_LOGO = `
[ WAYLAND-YUTANI CYBERDEC ]
[ MU/TH/UR 6000 ]

>> INITIALIZE UPLINK <<
`;

// Optional: Add a system header for the top of the terminal
export const SYSTEM_HEADER = (provider, channel, model) =>
  `STATION: ${provider.toUpperCase()} // ${channel.toUpperCase()} // ${model}`;
