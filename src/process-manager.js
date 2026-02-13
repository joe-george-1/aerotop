const { execSync } = require('child_process');

class ProcessManager {
    /**
     * Kill a process by PID with a given signal.
     * @param {number} pid
     * @param {string} signal - e.g. 'SIGTERM', 'SIGKILL', 'SIGSTOP', 'SIGCONT'
     * @returns {{ success: boolean, error?: string }}
     */
    static killProcess(pid, signal = 'SIGTERM') {
        try {
            if (!pid || typeof pid !== 'number' || pid <= 0) {
                return { success: false, error: 'Invalid PID' };
            }
            // Don't allow killing PID 1 (init) or the current process
            if (pid === 1 || pid === process.pid) {
                return { success: false, error: 'Cannot kill this process' };
            }

            const validSignals = [
                'SIGTERM', 'SIGKILL', 'SIGSTOP', 'SIGCONT', 'SIGHUP',
                'SIGINT', 'SIGUSR1', 'SIGUSR2', 'SIGQUIT',
            ];
            if (!validSignals.includes(signal)) {
                return { success: false, error: `Invalid signal: ${signal}` };
            }

            process.kill(pid, signal);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Change the nice value of a process (renice).
     * @param {number} pid
     * @param {number} priority - Nice value (-20 to 19)
     * @returns {{ success: boolean, error?: string }}
     */
    static reniceProcess(pid, priority) {
        try {
            if (!pid || typeof pid !== 'number' || pid <= 0) {
                return { success: false, error: 'Invalid PID' };
            }
            if (typeof priority !== 'number' || priority < -20 || priority > 19) {
                return { success: false, error: 'Priority must be between -20 and 19' };
            }

            execSync(`renice ${priority} -p ${pid}`, { stdio: 'pipe' });
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
}

module.exports = ProcessManager;
