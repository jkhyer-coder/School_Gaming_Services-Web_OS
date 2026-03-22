let topZ = 100;
let installedApps = JSON.parse(localStorage.getItem('installedApps') || '[]');
let appRegistry = [];

// Prevent default right click
document.addEventListener('contextmenu', e => {
    e.preventDefault();
    hideContextMenu();
});
document.addEventListener('click', hideContextMenu);

async function initOS() {
    await VFS.init();
    
    // Load apps config
    try {
        const res = await fetch('apps.json');
        appRegistry = await res.json();
    } catch(e) {
        console.error("Missing apps.json.");
        appRegistry = [];
    }

    renderDesktop();
    renderAppStore();
    
    // Clock
    setInterval(() => {
        const d = new Date();
        document.getElementById('clock').innerText = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }, 1000);

    // Start Menu toggle
    document.getElementById('start-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('start-menu').classList.toggle('hidden');
    });
    document.body.addEventListener('click', (e) => {
        if(!e.target.closest('#start-menu')) document.getElementById('start-menu').classList.add('hidden');
    });

    window.addEventListener('vfs-updated', renderDesktop);
}

function renderDesktop() {
    const desktop = document.getElementById('desktop');
    desktop.innerHTML = '';

    // Render Apps
    appRegistry.forEach(app => {
        if(app.preinstalled || installedApps.includes(app.id)) {
            const icon = document.createElement('div');
            icon.className = 'desktop-icon';
            icon.innerHTML = `<div class="icon-placeholder">${app.name.charAt(0)}</div><span>${app.name}.exe</span>`;
            icon.onclick = () => openWindow(app.name, app.path);
            icon.oncontextmenu = (e) => showContextMenu(e, 'app', app);
            desktop.appendChild(icon);
        }
    });

    // Render VFS Files
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
            if(app.preinstalled) return; // Hide preinstalled from store
            const btn = document.createElement('div');
            btn.className = 'desktop-icon';
            btn.style.color = '#333';
            btn.style.textShadow = 'none';
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

// Opens app or external url in a window
function openWindow(title, url, contentHTML = null) {
    const win = document.createElement('div');
    win.className = 'window';
    win.style.width = '700px';
    win.style.height = '500px';
    win.style.left = '100px';
    win.style.top = '50px';
    topZ++;
    win.style.zIndex = topZ;

    win.innerHTML = `
        <div class="window-header">
            <div class="window-title">${title}</div>
            <div class="window-controls">
                <div class="win-btn box">□</div>
                <div class="win-btn close">X</div>
            </div>
        </div>
        <div class="window-content">
            <div class="drag-shield"></div>
            ${contentHTML ? contentHTML : `<iframe src="${url}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`}
        </div>
    `;

    document.body.appendChild(win);

    const header = win.querySelector('.window-header');
    const shield = win.querySelector('.drag-shield');
    let isDown = false, startX, startY, winX, winY;

    header.addEventListener('mousedown', e => {
        isDown = true;
        topZ++; win.style.zIndex = topZ;
        startX = e.clientX; startY = e.clientY;
        winX = win.offsetLeft; winY = win.offsetTop;
        // Fix for iframe swallowing mouse drag events
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

    win.addEventListener('mousedown', () => { topZ++; win.style.zIndex = topZ; });

    win.querySelector('.close').onclick = () => win.remove();
    win.querySelector('.box').onclick = () => {
        if(win.style.width === '100%') {
            win.style.width = '700px'; win.style.height = '500px';
            win.style.left = '100px'; win.style.top = '50px';
        } else {
            win.style.width = '100%'; win.style.height = 'calc(100% - 48px)';
            win.style.left = '0'; win.style.top = '0';
        }
    };
}

// Opens local VFS files
function openFile(file) {
    if(file.name.endsWith('.html')) {
        openWindow(file.name, null, `<iframe srcdoc="${file.content.replace(/"/g, '&quot;')}"></iframe>`);
    } else if(file.name.endsWith('.txt')) {
        openWindow(file.name, null, `<textarea style="width:100%;height:100%;resize:none;padding:10px;box-sizing:border-box;" readonly>${file.content}</textarea>`);
    } else if(file.name.endsWith('.png') || file.name.endsWith('.jpg')) {
        openWindow(file.name, null, `<img src="${file.content}" style="max-width:100%;max-height:100%;display:block;margin:auto;">`);
    } else {
        alert('Filetype not supported');
    }
}

// Context Menu Logic
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
        delBtn.style.display = 'none'; // Cant delete preinstalled
    } else {
        delBtn.style.display = 'block';
    }
}

function hideContextMenu() {
    document.getElementById('context-menu').classList.add('hidden');
}

document.getElementById('ctx-open').onclick = () => {
    if(ctxTarget.type === 'app') openWindow(ctxTarget.data.name, ctxTarget.data.path);
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
