"""
Fix getAdjustedPath in components-loader.js and resolvePath in ui-helpers.js
to return clean URLs like /login instead of /src/pages/login.html
"""

# ---- components-loader.js ----
with open('frontend/src/services/components-loader.js', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = '    getAdjustedPath(path) {'
end_marker = '\n        return root + cleanPath + query;\n    }\n};\n'

start = content.find(start_marker)
end = content.find(end_marker, start) + len(end_marker)

old_block = content[start:end]
print(f"Old block length: {len(old_block)}")
print("First 80 chars:", repr(old_block[:80]))

new_block = '''    getAdjustedPath(path) {
        // Returns clean root-relative URLs (e.g. /catalog, /login, /admin/index).
        // The Vite dev middleware and Vercel rewrites map these to src/pages/*.html
        // transparently, so the browser URL stays clean.
        const root = '/';

        if (!path || path === '#' || path === './') {
            return root;
        }

        // Absolute URLs and javascript: pass through unchanged.
        if (path.startsWith('/') || path.startsWith('http') || path.startsWith('javascript:')) {
            return path;
        }

        // Normalise: strip leading ./ or extra /
        let cleanPath = path.replace(/^\\.\\//g, '').replace(/^\\/+/g, '');

        // Strip legacy src/pages/ prefix so old callers still work.
        cleanPath = cleanPath.replace(/^src\\/pages\\//, '').replace(/^pages\\//, '');

        // Strip .html extension — Vercel cleanUrls + dev middleware handle it
        cleanPath = cleanPath.replace(/\\.html$/, '');

        // Admin shortcut: 'admin' or 'admin/' → /admin/index
        if (cleanPath === 'admin' || cleanPath === 'admin/') {
            return root + 'admin/index';
        }

        // Separate query string if present
        let query = '';
        if (cleanPath.includes('?')) {
            const parts = cleanPath.split('?');
            cleanPath = parts[0];
            query = '?' + parts[1];
        }

        // Assets stay in src/
        if (cleanPath.startsWith('assets/')) {
            return root + 'src/' + cleanPath + query;
        }

        return root + cleanPath + query;
    }
};\n'''

new_content = content[:start] + new_block + content[end:]

with open('frontend/src/services/components-loader.js', 'w', encoding='utf-8') as f:
    f.write(new_content)
print("components-loader.js updated.")

# ---- ui-helpers.js fallback resolvePath ----
with open('frontend/src/services/ui-helpers.js', 'r', encoding='utf-8') as f:
    uh = f.read()

# The fallback in ui-helpers.js (lines 179-217) - find and replace
old_fb = '''    // Fallback logic (must be consistent with ComponentLoader.getAdjustedPath)
    const root = '/';
    if (!path || path === '#' || path === './') {
        return root + 'index.html';
    }

    if (path.startsWith('/') || path.startsWith('http') || path.startsWith('javascript:')) {
        return path;
    }

    let cleanPath = path.replace(/^\\.\\//, '').replace(/^\\/+/, '');
    
    if (cleanPath === 'admin' || cleanPath === 'admin/') {
        cleanPath = 'pages/admin/index.html';
    }

    let query = '';
    if (cleanPath.includes('?')) {
        const parts = cleanPath.split('?');
        cleanPath = parts[0];
        query = '?' + parts[1];
    }

    if (cleanPath === 'index' || cleanPath === '404' || cleanPath === 'index.html' || cleanPath === '404.html') {
        if (!cleanPath.endsWith('.html')) cleanPath += '.html';
        return root + cleanPath + query;
    }

    if (cleanPath.startsWith('assets/')) {
        return root + 'src/' + cleanPath + query;
    }



    if (!cleanPath.includes('.') && !cleanPath.endsWith('/')) {
        cleanPath += '.html';
    }

    return root + cleanPath + query;
}'''

new_fb = '''    // Fallback logic (must be consistent with ComponentLoader.getAdjustedPath)
    const root = '/';
    if (!path || path === '#' || path === './') {
        return root;
    }

    if (path.startsWith('/') || path.startsWith('http') || path.startsWith('javascript:')) {
        return path;
    }

    let cleanPath = path.replace(/^\\.\\//, '').replace(/^\\/+/, '');

    // Strip legacy src/pages/ prefix so old callers still work.
    cleanPath = cleanPath.replace(/^src\\/pages\\//, '').replace(/^pages\\//, '');

    // Strip .html extension
    cleanPath = cleanPath.replace(/\\.html$/, '');

    if (cleanPath === 'admin' || cleanPath === 'admin/') {
        return root + 'admin/index';
    }

    let query = '';
    if (cleanPath.includes('?')) {
        const parts = cleanPath.split('?');
        cleanPath = parts[0];
        query = '?' + parts[1];
    }

    if (cleanPath.startsWith('assets/')) {
        return root + 'src/' + cleanPath + query;
    }

    return root + cleanPath + query;
}'''

if old_fb in uh:
    uh = uh.replace(old_fb, new_fb)
    with open('frontend/src/services/ui-helpers.js', 'w', encoding='utf-8') as f:
        f.write(uh)
    print("ui-helpers.js fallback updated.")
else:
    print("ui-helpers.js fallback NOT found - searching...")
    idx = uh.find('Fallback logic')
    print(repr(uh[idx-4:idx+200]))
