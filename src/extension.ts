import * as vscode from 'vscode';

let statusBarItem: vscode.StatusBarItem;
let intervalId: NodeJS.Timeout | null = null;
let isEnabled = true;

// PER-WINDOW state storage (not global config)
// Each VS Code window has its own ExtensionContext, so this is window-specific
let windowState: vscode.Memento;

// EXACT Antigravity command IDs - found from package.json keybindings
const ANTIGRAVITY_ACCEPT_COMMANDS = [
    'antigravity.agent.acceptAgentStep',
    'antigravity.terminalCommand.accept',
    'antigravity.prioritized.agentAcceptFocusedHunk',
    'antigravity.command.accept',
    'antigravity.terminalCommand.run',
];

export function activate(context: vscode.ExtensionContext) {
    console.log('🚀 Auto Proceed extension activated');

    // Use workspaceState for PER-WINDOW storage (not globalState)
    // Each window gets its own independent state
    windowState = context.workspaceState;

    // Load per-window state (defaults to true if not set)
    isEnabled = windowState.get('autoProceedEnabled', false);

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'auto-proceed.toggle';
    context.subscriptions.push(statusBarItem);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('auto-proceed.toggle', toggleAutoProceed),
        vscode.commands.registerCommand('auto-proceed.enable', () => setAutoProceed(true)),
        vscode.commands.registerCommand('auto-proceed.disable', () => setAutoProceed(false)),
        vscode.commands.registerCommand('auto-proceed.triggerNow', async () => {
            await tryAutoProceed();
            vscode.window.showInformationMessage('Auto Proceed: Manual trigger executed');
        })
    );

    // Start if enabled for this window
    if (isEnabled) {
        startAutoProceeding();
    }
    updateStatusBar();
}

function toggleAutoProceed() {
    setAutoProceed(!isEnabled);
}

function setAutoProceed(enabled: boolean) {
    isEnabled = enabled;

    // Save to PER-WINDOW state (not global)
    windowState.update('autoProceedEnabled', enabled);

    if (enabled) {
        startAutoProceeding();
        vscode.window.showInformationMessage('✅ Auto Proceed ENABLED for this window');
    } else {
        stopAutoProceeding();
        vscode.window.showInformationMessage('❌ Auto Proceed DISABLED for this window');
    }
    updateStatusBar();
}

function startAutoProceeding() {
    if (intervalId) {
        clearInterval(intervalId);
    }

    const config = vscode.workspace.getConfiguration('autoProceed');
    const intervalMs = config.get('intervalMs', 1500);

    intervalId = setInterval(async () => {
        await tryAutoProceed();
    }, intervalMs);

    console.log(`Auto Proceed started with ${intervalMs}ms interval`);
}

function stopAutoProceeding() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    console.log('Auto Proceed stopped');
}

async function tryAutoProceed(): Promise<void> {
    for (const cmd of ANTIGRAVITY_ACCEPT_COMMANDS) {
        try {
            await vscode.commands.executeCommand(cmd);
        } catch {
            // Command not available in current context - continue silently
        }
    }
}

function updateStatusBar() {
    if (isEnabled) {
        statusBarItem.text = '$(check) Auto-Proceed ON';
        statusBarItem.tooltip = 'Auto Proceed is ACTIVE for this window\nClick to disable';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
        statusBarItem.text = '$(x) Auto-Proceed OFF';
        statusBarItem.tooltip = 'Auto Proceed is OFF for this window\nClick to enable';
        statusBarItem.backgroundColor = undefined;
    }
    statusBarItem.show();
}

export function deactivate() {
    stopAutoProceeding();
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
