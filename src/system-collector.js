const si = require('systeminformation');
const { EventEmitter } = require('events');

class SystemCollector extends EventEmitter {
    constructor() {
        super();
        this._interval = null;
        this._cpuHistory = []; // Rolling history for EQ visualizer
        this._maxHistory = 60; // 60 seconds of history
        this._lastSnapshot = null;
    }

    start(intervalMs = 1000) {
        // Fire immediately, then on interval
        this._collect();
        this._interval = setInterval(() => this._collect(), intervalMs);
    }

    stop() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
    }

    async _collect() {
        try {
            const [
                cpuLoad,
                cpuInfo,
                mem,
                processes,
                time,
                networkStats,
                disksIO,
                cpuTemp,
                fsSize,
                osInfo,
            ] = await Promise.all([
                si.currentLoad(),
                this._getCachedCpuInfo(),
                si.mem(),
                si.processes(),
                si.time(),
                si.networkStats(),
                si.disksIO().catch(() => null),
                si.cpuTemperature().catch(() => null),
                si.fsSize().catch(() => []),
                this._getCachedOsInfo(),
            ]);

            // Build per-core load array
            const coreLoads = cpuLoad.cpus.map((c, i) => ({
                core: i,
                load: c.load,
                loadUser: c.load_user,
                loadSystem: c.load_system,
                loadNice: c.load_nice,
                loadIdle: c.load_idle,
            }));

            // Push to CPU history (rolling window)
            this._cpuHistory.push({
                timestamp: Date.now(),
                overall: cpuLoad.currentLoad,
                cores: coreLoads.map(c => c.load),
            });
            if (this._cpuHistory.length > this._maxHistory) {
                this._cpuHistory.shift();
            }

            // Normalize process list (top 200 by CPU, to avoid overwhelming the renderer)
            const procList = (processes.list || [])
                .sort((a, b) => b.cpu - a.cpu)
                .slice(0, 500)
                .map(p => ({
                    pid: p.pid,
                    parentPid: p.parentPid,
                    name: p.name,
                    command: p.command,
                    user: p.user,
                    cpu: p.cpu,
                    mem: p.mem,
                    memVsz: p.memVsz,
                    memRss: p.memRss,
                    state: p.state,
                    nice: p.nice,
                    priority: p.priority,
                    started: p.started,
                    tty: p.tty,
                }));

            // Build snapshot
            const snapshot = {
                timestamp: Date.now(),

                cpu: {
                    model: cpuInfo.manufacturer + ' ' + cpuInfo.brand,
                    cores: cpuInfo.cores,
                    physicalCores: cpuInfo.physicalCores,
                    speed: cpuInfo.speed,
                    overallLoad: cpuLoad.currentLoad,
                    userLoad: cpuLoad.currentLoadUser,
                    systemLoad: cpuLoad.currentLoadSystem,
                    coreLoads,
                    history: this._cpuHistory,
                },

                memory: {
                    total: mem.total,
                    used: mem.used,
                    free: mem.free,
                    active: mem.active,
                    available: mem.available,
                    cached: mem.cached,
                    buffers: mem.buffers,
                    swapTotal: mem.swaptotal,
                    swapUsed: mem.swapused,
                    swapFree: mem.swapfree,
                },

                processes: {
                    all: processes.all,
                    running: processes.running,
                    blocked: processes.blocked,
                    sleeping: processes.sleeping,
                    list: procList,
                },

                load: {
                    avg1: cpuLoad.avgLoad || 0,
                    currentLoad: cpuLoad.currentLoad,
                },

                uptime: time.uptime,

                network: (networkStats || []).map(n => ({
                    iface: n.iface,
                    rxBytes: n.rx_bytes,
                    txBytes: n.tx_bytes,
                    rxSec: n.rx_sec,
                    txSec: n.tx_sec,
                })),

                disk: disksIO ? {
                    rIO: disksIO.rIO,
                    wIO: disksIO.wIO,
                    rIOSec: disksIO.rIO_sec,
                    wIOSec: disksIO.wIO_sec,
                } : null,

                temperature: cpuTemp ? {
                    main: cpuTemp.main,
                    cores: cpuTemp.cores,
                    max: cpuTemp.max,
                } : null,

                filesystems: (fsSize || []).map(fs => ({
                    fs: fs.fs,
                    type: fs.type,
                    mount: fs.mount,
                    size: fs.size,
                    used: fs.used,
                    available: fs.available,
                    usePct: fs.use,
                })),

                os: {
                    platform: osInfo.platform,
                    distro: osInfo.distro,
                    release: osInfo.release,
                    kernel: osInfo.kernel,
                    hostname: osInfo.hostname,
                },
            };

            this._lastSnapshot = snapshot;
            this.emit('snapshot', snapshot);
        } catch (err) {
            console.error('SystemCollector error:', err);
        }
    }

    // Cache CPU info (static, doesn't change)
    async _getCachedCpuInfo() {
        if (!this._cpuInfoCache) {
            this._cpuInfoCache = await si.cpu();
        }
        return this._cpuInfoCache;
    }

    // Cache OS info (static)
    async _getCachedOsInfo() {
        if (!this._osInfoCache) {
            this._osInfoCache = await si.osInfo();
        }
        return this._osInfoCache;
    }

    // Build a process tree from the flat list
    async getProcessTree() {
        if (!this._lastSnapshot) return [];

        const procs = this._lastSnapshot.processes.list;
        const byPid = new Map();
        const roots = [];

        // Index all processes
        procs.forEach(p => {
            byPid.set(p.pid, { ...p, children: [] });
        });

        // Build tree
        procs.forEach(p => {
            const node = byPid.get(p.pid);
            const parent = byPid.get(p.parentPid);
            if (parent && parent !== node) {
                parent.children.push(node);
            } else {
                roots.push(node);
            }
        });

        return roots;
    }
}

module.exports = SystemCollector;
