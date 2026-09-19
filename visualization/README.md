# Routebox 3D infrastructure visualization

This directory is a self-contained browser visualization. It uses Three.js and
its official OrbitControls and CSS2DRenderer addons from jsDelivr; it does not
require an npm install or change the Terraform configuration.

## Preview

From the repository root, start a static server:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/visualization/>. Drag to orbit, right-drag to
pan, scroll or pinch to zoom, and use **Bird’s-eye view** for the top-down view.
An internet connection is required to load the Three.js modules from the CDN.
