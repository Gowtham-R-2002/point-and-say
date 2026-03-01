import { Avatar, LinearProgress } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faProjectDiagram,
    faStar,
    faUserPlus,
} from '@fortawesome/free-solid-svg-icons';

export function ProfileCard() {
    return (
        <div className="profile-card glass-card" data-component="profile-card">
            <div className="profile-header" data-component="profile-avatar">
                <Avatar
                    sx={{
                        width: 72,
                        height: 72,
                        background: 'linear-gradient(135deg, rgba(251,140,102,0.3), rgba(168,85,247,0.3))',
                        color: '#fff',
                        fontSize: '1.4rem',
                        fontWeight: 700,
                        fontFamily: 'var(--font-sans)',
                        border: '3px solid rgba(255,255,255,0.1)',
                    }}
                >
                    SC
                </Avatar>
                <div className="profile-online-dot" />
            </div>

            <h3 className="profile-name" data-component="profile-name">Sarah Chen</h3>
            <p className="profile-role" data-component="profile-role">Senior Product Designer</p>

            <LinearProgress
                variant="determinate"
                value={78}
                sx={{
                    width: '80%',
                    mx: 'auto',
                    my: 2,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    '& .MuiLinearProgress-bar': {
                        borderRadius: 2,
                        background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-purple))',
                    },
                }}
            />

            <div className="profile-stats" data-component="profile-stats">
                <div className="profile-stat-item">
                    <FontAwesomeIcon icon={faProjectDiagram} style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginBottom: 4 }} />
                    <span className="profile-stat-value">142</span>
                    <span className="profile-stat-label">PROJECTS</span>
                </div>
                <div className="profile-stat-item">
                    <FontAwesomeIcon icon={faStar} style={{ color: 'var(--accent-primary)', fontSize: '0.65rem', marginBottom: 4 }} />
                    <span className="profile-stat-value" style={{ color: 'var(--accent-primary)' }}>98%</span>
                    <span className="profile-stat-label">RATING</span>
                </div>
                <div className="profile-stat-item">
                    <FontAwesomeIcon icon={faUserPlus} style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginBottom: 4 }} />
                    <span className="profile-stat-value">3.2k</span>
                    <span className="profile-stat-label">FOLLOWERS</span>
                </div>
            </div>
        </div>
    );
}
