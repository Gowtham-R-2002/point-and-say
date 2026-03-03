"""
Project Scanner Service

Scans a project directory to auto-discover React/Vue/Svelte components,
detect the framework from package.json, and build a dynamic component registry.
"""
import os
import json
import re
from typing import Optional


def scan_project(project_path: str) -> dict:
    """
    Scan a project directory and return framework info + discovered components.

    Returns:
        dict with framework, devCommand, components list
    """
    result = {
        "projectPath": project_path,
        "framework": "unknown",
        "devCommand": "npm run dev",
        "components": [],
        "totalFiles": 0,
    }

    if not os.path.isdir(project_path):
        result["error"] = f"Directory not found: {project_path}"
        return result

    # Detect framework from package.json
    pkg_path = os.path.join(project_path, "package.json")
    if os.path.exists(pkg_path):
        try:
            with open(pkg_path, "r") as f:
                pkg = json.load(f)
            result["framework"] = _detect_framework(pkg)
            result["devCommand"] = _get_dev_command(pkg)
        except Exception:
            pass

    # Scan for component files
    components = _scan_components(project_path, result["framework"])
    result["components"] = components
    result["totalFiles"] = len(components)

    return result


def _detect_framework(pkg: dict) -> str:
    """Detect the frontend framework from package.json dependencies."""
    all_deps = {}
    all_deps.update(pkg.get("dependencies", {}))
    all_deps.update(pkg.get("devDependencies", {}))

    if "next" in all_deps:
        return "Next.js"
    if "nuxt" in all_deps:
        return "Nuxt"
    if "@angular/core" in all_deps:
        return "Angular"
    if "svelte" in all_deps:
        return "Svelte"
    if "vue" in all_deps:
        return "Vue"
    if "react" in all_deps:
        if "vite" in all_deps:
            return "React (Vite)"
        return "React"
    return "unknown"


def _get_dev_command(pkg: dict) -> str:
    """Get the dev server command from package.json scripts."""
    scripts = pkg.get("scripts", {})
    if "dev" in scripts:
        return "npm run dev"
    if "start" in scripts:
        return "npm start"
    if "serve" in scripts:
        return "npm run serve"
    return "npm run dev"


def _scan_components(project_path: str, framework: str) -> list[dict]:
    """Scan the project for component files."""
    components = []
    src_dir = os.path.join(project_path, "src")

    if not os.path.isdir(src_dir):
        # Try common alternatives
        for alt in ["app", "pages", "components", "lib"]:
            alt_path = os.path.join(project_path, alt)
            if os.path.isdir(alt_path):
                src_dir = alt_path
                break

    if not os.path.isdir(src_dir):
        return components

    # File extensions to scan
    extensions = {".tsx", ".jsx", ".vue", ".svelte"}

    for root, _dirs, files in os.walk(src_dir):
        # Skip node_modules, test dirs, etc.
        rel_root = os.path.relpath(root, project_path)
        if any(skip in rel_root for skip in ["node_modules", "__test", ".test", ".spec", "dist"]):
            continue

        for filename in files:
            _, ext = os.path.splitext(filename)
            if ext not in extensions:
                continue

            full_path = os.path.join(root, filename)
            rel_path = os.path.relpath(full_path, project_path)

            # Parse the file to extract component info
            try:
                with open(full_path, "r") as f:
                    content = f.read()

                comp_info = _parse_component(filename, rel_path, content, framework)
                if comp_info:
                    components.append(comp_info)
            except Exception:
                continue

    return components


def _parse_component(filename: str, rel_path: str, content: str, framework: str) -> Optional[dict]:
    """Parse a component file and extract its name and type."""
    name_without_ext = os.path.splitext(filename)[0]

    # Skip non-component files
    skip_names = {"main", "index", "App", "vite-env", "reportWebVitals", "setupTests"}
    if name_without_ext in skip_names:
        return None

    # Detect component name from export
    component_name = name_without_ext

    # Look for named exports: export function ComponentName / export const ComponentName
    export_match = re.search(
        r'export\s+(?:default\s+)?(?:function|const|class)\s+(\w+)',
        content
    )
    if export_match:
        component_name = export_match.group(1)

    # Detect data-component attributes already in the file
    data_attrs = re.findall(r'data-component=["\']([^"\']+)["\']', content)

    # Detect the element type from the component content
    element_type = "component"
    name_lower = name_without_ext.lower()
    content_lower = content.lower()

    if "button" in name_lower:
        element_type = "button"
    elif "table" in name_lower or "transaction" in name_lower:
        element_type = "table"
    elif "chart" in name_lower or "graph" in name_lower or "revenue" in name_lower:
        element_type = "chart"
    elif "card" in name_lower or "stat" in name_lower:
        element_type = "card"
    elif "sidebar" in name_lower or "nav" in name_lower:
        element_type = "navigation"
    elif "form" in name_lower:
        element_type = "form"
    elif "hero" in name_lower or "banner" in name_lower:
        element_type = "section"
    elif "header" in name_lower:
        element_type = "section"
    elif "feed" in name_lower or "activity" in name_lower:
        element_type = "card"
    elif "traffic" in name_lower or "source" in name_lower:
        element_type = "chart"
    elif "customer" in name_lower or "user" in name_lower:
        element_type = "table"
    elif "action" in name_lower or "quick" in name_lower:
        element_type = "button"
    elif "profile" in name_lower:
        element_type = "card"
    # Fallback: check content
    elif "button" in content_lower and "<button" in content_lower:
        element_type = "button"
    elif "<table" in content_lower or "thead" in content_lower:
        element_type = "table"
    elif "<svg" in content_lower and ("chart" in content_lower or "path" in content_lower):
        element_type = "chart"
    elif "card" in content_lower:
        element_type = "card"


    return {
        "name": component_name,
        "fileName": filename,
        "filePath": rel_path.replace("\\", "/"),  # Normalize path separators
        "elementType": element_type,
        "dataAttributes": data_attrs,
        "lineCount": content.count("\n") + 1,
    }
