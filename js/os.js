let topZ = 100;
let installedApps = JSON.parse(localStorage.getItem('installedApps') || '[]');
let appRegistry = [];

// App state management for Taskbar
let openWindows = []; // Tracks { winElement, appId }
const pinnedApps = ['file-explorer']; // Pre-pinned apps

document.addEventListener('contextmenu', e => { e.preventDefault(); hideContextMenu(); });
document.addEventListener('click', hideContextMenu);

async function initOS() {
    await VFS.init();
    
    try {
        const res = await fetch('apps.json');
        appRegistry = await res.json();
    } catch(e) {
        console.error("Missing apps.json.");
        appRegistry = [];
    }

    renderDesktop();
    renderAppStore();
    renderTaskbar(); // Initialize taskbar
    
    // Clock
    setInterval(() => {
        const d = new Date();
        document.getElementById('clock-time').innerText = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        document.getElementById('clock-date').innerText = d.toLocaleDateString();
    }, 1000);

    // Start Menu toggle closing
    document.body.addEventListener('click', (e) => {
        if(!e.target.closest('#start-menu') && !e.target.closest('#start-btn')) {
            document.getElementById('start-menu').classList.add('hidden');
        }
    });

    window.addEventListener('vfs-updated', renderDesktop);
}

function renderTaskbar() {
    const taskbar = document.getElementById('taskbar-icons');
    taskbar.innerHTML = ''; // Clear taskbar
    
    // 1. Add Start Button
    const startBtn = document.createElement('div');
    startBtn.className = 'taskbar-icon start-btn';
    startBtn.id = 'start-btn';
    startBtn.innerHTML = `<img class="start-icon" src="https://upload.wikimedia.org/wikipedia/commons/e/e6/Windows_11_logo.svg" alt="Start">`;
    startBtn.onclick = (e) => {
        e.stopPropagation();
        document.getElementById('start-menu').classList.toggle('hidden');
    };
    taskbar.appendChild(startBtn);

    // 2. Determine apps to show (Pinned + Currently Open)
    const activeAppIds = [...new Set(openWindows.filter(w => w.appId !== null).map(w => w.appId))];
    const appsToShow = [...new Set([...pinnedApps, ...activeAppIds])];

    // 3. Render App Icons
    appsToShow.forEach(appId => {
        const app = appRegistry.find(a => a.id === appId);
        if(!app) return;

        const isOpen = activeAppIds.includes(appId);
        // Determine if it's the top-most active window
        const isActive = openWindows.length > 0 && openWindows[openWindows.length - 1].appId === appId;

        const btn = document.createElement('div');
        btn.className = `taskbar-icon ${isOpen ? 'is-open active-app' : ''} ${isActive ? 'is-active' : ''}`;
        btn.innerHTML = `<div class="icon-placeholder-small">${app.name.charAt(0)}</div>`;
        
        btn.onclick = () => {
            if (isOpen) {
                // Find highest z-index window of this app and bring to front
                const appWins = openWindows.filter(w => w.appId === appId);
                const targetWin = appWins[appWins.length - 1].winElement;
                bringToFront(targetWin);
            } else {
                openWindow(app.name, app.path, null, app.id);
            }
        };
        taskbar.appendChild(btn);
    });
}

function bringToFront(win) {
    topZ++;
    win.style.zIndex = topZ;
    // Move to end of openWindows array to track as "most recently active"
    const index = openWindows.findIndex(w => w.winElement === win);
    if(index !== -1) {
        const obj = openWindows.splice(index, 1)[0];
        openWindows.push(obj);
    }
    renderTaskbar();
}

function renderDesktop() {
    const desktop = document.getElementById('desktop');
    desktop.innerHTML = '';

    appRegistry.forEach(app => {
        if(app.preinstalled || installedApps.includes(app.id)) {
            const icon = document.createElement('div');
            icon.className = 'desktop-icon';
            icon.innerHTML = `<div class="icon-placeholder">${app.name.charAt(0)}</div><span>${app.name}</span>`;
            icon.onclick = () => openWindow(app.name, app.path, null, app.id);
            icon.oncontextmenu = (e) => showContextMenu(e, 'app', app);
            desktop.appendChild(icon);
        }
    });

    VFS.getFiles().then(files => {
        files.forEach(file => {
            const icon = document.createElement('div');
            icon.className = 'desktop-icon';
            let ext = file.name.split('.').pop();
            icon.innerHTML = `<div class="icon-placeholder" style="background:#555">${ext.toUpperCase()}</div><span>${file.name}</span>`;
            icon.onclick = () => openFile(file);
            icon.oncontextmenu = (e) => showContextMenu(e, 'file', file);
            desktop.appendChild(icon);
        });
    });
}

function renderAppStore() {
    const store = document.getElementById('store-categories');
    store.innerHTML = '';
    
    const categories = [...new Set(appRegistry.map(a => a.category || 'Other'))];
    
    categories.forEach(cat => {
        const section = document.createElement('div');
        section.innerHTML = `<div class="category-header">${cat}</div>`;
        const grid = document.createElement('div');
        grid.className = 'app-grid';
        
        appRegistry.filter(a => a.category === cat).forEach(app => {
            if(app.preinstalled) return; 
            const btn = document.createElement('div');
            btn.className = 'desktop-icon';
            btn.innerHTML = `<div class="icon-placeholder">${app.name.charAt(0)}</div><span>${app.name}</span>`;
            
            btn.onclick = () => {
                if(!installedApps.includes(app.id)) {
                    if(confirm(`Install ${app.name}?`)) {
                        installedApps.push(app.id);
                        localStorage.setItem('installedApps', JSON.stringify(installedApps));
                        renderDesktop();
                        renderAppStore();
                    }
                } else {
                    alert('App is already installed.');
                }
            };
            grid.appendChild(btn);
        });
        section.appendChild(grid);
        store.appendChild(section);
    });
}

// Added appId tracking to the window generator
function openWindow(title, url, contentHTML = null, appId = null) {
    const win = document.createElement('div');
    win.className = 'window';
    win.style.width = '700px';
    win.style.height = '500px';
    win.style.left = '150px';
    win.style.top = '100px';
    topZ++;
    win.style.zIndex = topZ;

    win.innerHTML = `
        <div class="window-header">
            <div class="window-title">${title}</div>
            <div class="window-controls">
                <div class="win-btn minimize" style="font-size: 16px;">—</div>
                <div class="win-btn box" style="font-size: 16px;">□</div>
                <div class="win-btn close" style="font-size: 14px;">✕</div>
            </div>
        </div>
        <div class="window-content">
            <div class="drag-shield"></div>
            ${contentHTML ? contentHTML : `<iframe src="${url}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`}
        </div>
    `;

    document.body.appendChild(win);
    
    // Register Window in Taskbar
    openWindows.push({ winElement: win, appId: appId });
    renderTaskbar();

    const header = win.querySelector('.window-header');
    let isDown = false, startX, startY, winX, winY;

    header.addEventListener('mousedown', e => {
        if(e.target.closest('.window-controls')) return; // Ignore dragging if clicking buttons
        isDown = true;
        bringToFront(win);
        startX = e.clientX; startY = e.clientY;
        winX = win.offsetLeft; winY = win.offsetTop;
        document.querySelectorAll('.drag-shield').forEach(s => s.style.display = 'block');
    });

    window.addEventListener('mousemove', e => {
        if(!isDown) return;
        win.style.left = (winX + e.clientX - startX) + 'px';
        win.style.top = (winY + e.clientY - startY) + 'px';
    });

    window.addEventListener('mouseup', () => {
        isDown = false;
        document.querySelectorAll('.drag-shield').forEach(s => s.style.display = 'none');
    });

    win.addEventListener('mousedown', () => bringToFront(win));

    win.querySelector('.close').onclick = () => {
        win.remove();
        openWindows = openWindows.filter(w => w.winElement !== win);
        renderTaskbar(); // Remove pill indicator
    };
    
    // Minimize simply acts like clicking out, real minimization involves display:none. Kept simple:
    win.querySelector('.minimize').onclick = () => {
        win.style.zIndex = 1; // Send to back
        renderTaskbar();
    };

    win.querySelector('.box').onclick = () => {
        if(win.style.width === '100%') {
            win.style.width = '700px'; win.style.height = '500px';
            win.style.left = '150px'; win.style.top = '100px';
        } else {
            win.style.width = '100%'; win.style.height = 'calc(100% - 48px)';
            win.style.left = '0'; win.style.top = '0';
        }
    };
}

function openFile(file) {
    if(file.name.endsWith('.html')) {
        openWindow(file.name, null, `<iframe srcdoc="${file.content.replace(/"/g, '&quot;')}"></iframe>`);
    } else if(file.name.endsWith('.txt')) {
        openWindow(file.name, null, `<textarea style="width:100%;height:100%;resize:none;padding:15px;box-sizing:border-box;background:#1e1e1e;color:#fff;border:none;outline:none;" readonly>${file.content}</textarea>`);
    } else if(file.name.endsWith('.png') || file.name.endsWith('.jpg')) {
        openWindow(file.name, null, `<div style="background:#111;height:100%;display:flex;align-items:center;justify-content:center;"><img src="${file.content}" style="max-width:100%;max-height:100%;"></div>`);
    } else {
        alert('Filetype not supported');
    }
}

// Context Menu
let ctxTarget = null;
function showContextMenu(e, type, data) {
    e.preventDefault();
    e.stopPropagation();
    ctxTarget = { type, data };
    const menu = document.getElementById('context-menu');
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.classList.remove('hidden');

    const delBtn = document.getElementById('ctx-delete');
    if(type === 'app' && data.preinstalled) {
        delBtn.style.display = 'none'; 
    } else {
        delBtn.style.display = 'block';
    }
}

function hideContextMenu() {
    document.getElementById('context-menu').classList.add('hidden');
}

document.getElementById('ctx-open').onclick = () => {
    if(ctxTarget.type === 'app') openWindow(ctxTarget.data.name, ctxTarget.data.path, null, ctxTarget.data.id);
    if(ctxTarget.type === 'file') openFile(ctxTarget.data);
};

document.getElementById('ctx-delete').onclick = () => {
    if(ctxTarget.type === 'app' && !ctxTarget.data.preinstalled) {
        installedApps = installedApps.filter(id => id !== ctxTarget.data.id);
        localStorage.setItem('installedApps', JSON.stringify(installedApps));
        renderDesktop();
        renderAppStore();
    } else if (ctxTarget.type === 'file') {
        VFS.deleteFile(ctxTarget.data.name);
    }
};

window.onload = initOS;
