import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChartLine,
    faUsers,
    faFolderOpen,
    faComments,
    faBell,
    faCog,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { Tooltip } from '@mui/material';

interface NavItem {
    icon: IconDefinition;
    label: string;
    id: string;
}

const navItems: NavItem[] = [
    { icon: faChartLine, label: 'Dashboard', id: 'dashboard' },
    { icon: faUsers, label: 'Team', id: 'team' },
    { icon: faFolderOpen, label: 'Projects', id: 'projects' },
    { icon: faComments, label: 'Messages', id: 'messages' },
    { icon: faBell, label: 'Notifications', id: 'notifications' },
    { icon: faCog, label: 'Settings', id: 'settings' },
];

export function Sidebar() {
    const [active, setActive] = useState('dashboard');

    return (
        <aside className="sidebar" data-component="sidebar">
            {/* Navigation */}
            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <Tooltip key={item.id} title={item.label} placement="right" arrow>
                        <button
                            className={`sidebar-nav-item ${active === item.id ? 'active' : ''}`}
                            onClick={() => setActive(item.id)}
                        >
                            {active === item.id && <span className="sidebar-active-bar" />}
                            <FontAwesomeIcon icon={item.icon} />
                        </button>
                    </Tooltip>
                ))}
            </nav>

            {/* Footer avatar */}
            <div className="sidebar-footer">
                <div className="sidebar-avatar">SC</div>
            </div>
        </aside>
    );
}
