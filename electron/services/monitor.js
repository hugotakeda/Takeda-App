const os = require('os');
const { execFile } = require('child_process');

let intervalId = null;
let pingIntervalId = null;
let buffer = { cpu: [], ram: [], lat: [] };
const MAX_POINTS = 60;
let previousCpuInfo = os.cpus();
let pingValue = 0;
let packetLoss = 0;

// Helper for CPU usage calculation
function getCpuUsage() {
  const currentCpuInfo = os.cpus();
  let idleDiff = 0;
  let totalDiff = 0;

  for (let i = 0; i < currentCpuInfo.length; i++) {
    const cpu = currentCpuInfo[i];
    const prevCpu = previousCpuInfo[i];

    for (const type in cpu.times) {
      totalDiff += cpu.times[type] - prevCpu.times[type];
    }
    idleDiff += cpu.times.idle - prevCpu.times.idle;
  }

  previousCpuInfo = currentCpuInfo;
  if (totalDiff === 0) return 0;
  return Math.round(100 - (100 * idleDiff) / totalDiff);
}

// Background ping
function checkPing() {
  execFile('ping', ['-n', '1', '-w', '1000', '8.8.8.8'], (err, stdout) => {
    if (err || stdout.includes('unreachable') || stdout.includes('timed out')) {
      packetLoss = 100;
      pingValue = -1;
    } else {
      const match = stdout.match(/time[=<](\d+)ms/i) || stdout.match(/tempo[=<](\d+)ms/i);
      if (match) {
        pingValue = parseInt(match[1]);
        packetLoss = 0;
      } else {
        pingValue = -1;
      }
    }
  });
}

function start(interval, callback) {
  if (intervalId) stop();
  
  // Initial ping
  checkPing();
  pingIntervalId = setInterval(checkPing, 5000); // update ping every 5s

  const poll = () => {
    const cpuVal = getCpuUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramUsedVal = parseFloat((usedMem / (1024 ** 3)).toFixed(1));
    const ramTotalVal = parseFloat((totalMem / (1024 ** 3)).toFixed(1));
    const ramPctVal = Math.round((usedMem / totalMem) * 100);

    buffer.cpu.push(cpuVal);
    buffer.ram.push(ramPctVal);
    buffer.lat.push(pingValue > -1 ? pingValue : 0);
    
    if (buffer.cpu.length > MAX_POINTS) buffer.cpu.shift();
    if (buffer.ram.length > MAX_POINTS) buffer.ram.shift();
    if (buffer.lat.length > MAX_POINTS) buffer.lat.shift();

    callback({
      cpu: cpuVal,
      ramUsed: ramUsedVal,
      ramTotal: ramTotalVal,
      ramPct: ramPctVal,
      ping: pingValue,
      packetLoss: packetLoss,
      cpuHistory: [...buffer.cpu],
      ramHistory: [...buffer.ram],
      latHistory: [...buffer.lat],
      timestamp: Date.now(),
    });
  };

  poll();
  intervalId = setInterval(poll, interval);
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (pingIntervalId) {
    clearInterval(pingIntervalId);
    pingIntervalId = null;
  }
}

function getCurrentPing() {
  return { ping: pingValue, packetLoss };
}

module.exports = { start, stop, getCurrentPing };
