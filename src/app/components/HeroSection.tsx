import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowRight,
} from '@fortawesome/free-solid-svg-icons';
import { Chip, Button } from '@mui/material';

export function HeroSection() {
    return (
        <section className="hero-banner" data-component="hero-section">
            <div className="hero-glow-orb hero-glow-1" />
            <div className="hero-glow-orb hero-glow-2" />

            <Chip
                label="AI-POWERED DASHBOARD"
                icon={<span style={{ fontSize: '0.7rem' }}>🔥</span>}
                size="small"
                sx={{
                    mb: 2,
                    alignSelf: 'flex-start',
                    background: 'rgba(251, 140, 102, 0.15)',
                    color: 'var(--accent-primary)',
                    fontWeight: 700,
                    fontSize: '0.65rem',
                    letterSpacing: '0.1em',
                    border: '1px solid rgba(251, 140, 102, 0.3)',
                    fontFamily: 'var(--font-sans)',
                }}
            />

            <h1 className="hero-title" data-component="hero-title">
                Welcome to <span className="hero-title-accent">Amazon Hackathon</span>
            </h1>

            <p className="hero-subtitle" data-component="hero-subtitle">
                Your intelligent analytics hub — point at any element and speak a command to
                customize this interface in real-time.
            </p>

            <Button
                data-component="hero-cta"
                variant="contained"
                startIcon={<FontAwesomeIcon icon={faArrowRight} style={{ fontSize: '1rem' }} />}
                endIcon={<FontAwesomeIcon icon={faArrowRight} style={{ fontSize: '0.7rem' }} />}
                sx={{
                    mt: 2,
                    alignSelf: 'flex-start',
                    background: 'linear-gradient(135deg, var(--accent-emerald) 0%, #34d399 100%)',
                    color: '#0c0c14',
                    fontWeight: 700,
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.85rem',
                    textTransform: 'none',
                    padding: '10px 28px',
                    borderRadius: 'var(--radius-full)',
                    boxShadow: '0 4px 24px rgba(52, 211, 153, 0.35)',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #34d399 0%, var(--accent-emerald) 100%)',
                        boxShadow: '0 6px 32px rgba(52, 211, 153, 0.5)',
                    },
                }}
            >
                Get Started
            </Button>
        </section>
    );
}
