async function updateAppList() {
    const btn = document.getElementById('update-store-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = `⏳ Scanning...`;
    btn.style.opacity = '0.5';
    btn.style.pointerEvents = 'none';

    // Auto-detect GitHub username and repository from the URL
    let user = '', repo = '';
    const host = window.location.hostname;
    
    if (host.includes('github.io')) {
        user = host.split('.')[0];
        const pathParts = window.location.pathname.split('/').filter(p => p.length > 0);
        repo = pathParts.length > 0 ? pathParts[0] : host; 
    } else {
        // Fallback or replace these manually if auto-detect fails
        let repoInfo = prompt("Cannot auto-detect GitHub repository.\nPlease enter it as 'username/repo':", localStorage.getItem('gh_repo_cache') || "");
        if (!repoInfo || !repoInfo.includes('/')) {
            resetBtn();
            return;
        }
        [user, repo] = repoInfo.split('/');
        localStorage.setItem('gh_repo_cache', repoInfo);
    }

    try {
        let newRegistry = [];
        
        // 1. Fetch preinstalled apps folder
        const preRes = await fetch(`https://api.github.com/repos/${user}/${repo}/contents/apps/preinstalled`);
        if (preRes.ok) {
            const files = await preRes.json();
            for(let file of files) {
                if(file.name.endsWith('.html')) {
                    let baseName = file.name.replace('.html', '');
                    let title = baseName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    newRegistry.push({
                        id: baseName,
                        name: title,
                        path: file.path,
                        category: "System",
                        preinstalled: true,
                        icon: title === "File Explorer" ? "📂" : null 
                    });
                }
            }
        }

        // 2. Fetch store apps folder
        const storeRes = await fetch(`https://api.github.com/repos/${user}/${repo}/contents/apps/store`);
        if (storeRes.ok) {
            const files = await storeRes.json();
            for(let file of files) {
                if(file.name.endsWith('.html')) {
                    let baseName = file.name.replace('.html', '');
                    let title = baseName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    
                    // ALL store apps are now forced perfectly into the "App Store" category
                    newRegistry.push({
                        id: baseName,
                        name: title,
                        path: file.path,
                        category: "App Store",
                        preinstalled: false
                    });
                }
            }
        }

        if (newRegistry.length > 0) {
            localStorage.setItem('dynamicAppRegistry', JSON.stringify(newRegistry));
            appRegistry = newRegistry;
            renderDesktop();
            renderAppStore();
            renderTaskbar();
            btn.innerHTML = `✅ Found ${newRegistry.length} Apps!`;
            setTimeout(() => resetBtn(), 3000);
        } else {
            alert("No HTML apps found. Make sure they are uploaded directly inside the /apps/store/ or /apps/preinstalled/ folders!");
            resetBtn();
        }

    } catch(e) {
        console.error(e);
        alert("Failed to connect to GitHub. Press F12 to check the console for exact errors.");
        resetBtn();
    }

    function resetBtn() {
        btn.innerHTML = originalText;
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
    }
}
